"""
bracket_parser.py - Universal NER Annotation Parser & Converter
Supports BIO CSV ("id","tokens","ner_tags"), BIO Format JSON (with integer tag IDs / string tags), 
Prodigy ner_manual JSONL, and Bracket-Annotated text.
"""

import re
import json
import csv
import time
import sys
import io
import argparse
import ast

# Default Integer BIO Tag ID Mappings
DEFAULT_TAG_TO_ID = {
    'O': 0,
    'B-PER': 1,
    'I-PER': 2,
    'B-ORG': 3,
    'I-ORG': 4,
    'B-LOC': 5,
    'I-LOC': 6,
    'B-DATE': 7,
    'I-DATE': 8
}

DEFAULT_ID_TO_TAG = {v: k for k, v in DEFAULT_TAG_TO_ID.items()}

def to_int32(val):
    val = val & 0xffffffff
    return val if val < 0x80000000 else val - 0x100000000

def get_timestamp_str():
    return time.strftime("%Y-%m-%d_%H-%M-%S")

def tokenize_text(clean_text):
    """
    Tokenizes clean text into token dictionaries matching spaCy/Prodigy tokenization.
    """
    tokens = []
    token_regex = re.compile(r'\S+|\s+')
    token_id = 0
    pos = 0
    
    for m in token_regex.finditer(clean_text):
        t_str = m.group()
        if t_str.isspace():
            if len(tokens) > 0:
                tokens[-1]['ws'] = True
            pos += len(t_str)
            continue
        
        # Split punctuation from words
        punct_split = re.finditer(r'[\w]+|[^\w\s]', t_str, re.UNICODE)
        for pt in punct_split:
            pt_str = pt.group()
            tokens.append({
                "text": pt_str,
                "start": pos,
                "end": pos + len(pt_str),
                "id": token_id,
                "ws": False 
            })
            pos += len(pt_str)
            token_id += 1

    return tokens

def align_tokens_to_text(token_texts, text):
    """
    Aligns a list of token text strings to full text to calculate start, end, id, and ws.
    """
    tokens = []
    pos = 0
    for idx, t_str in enumerate(token_texts):
        found_pos = text.find(t_str, pos)
        if found_pos == -1:
            found_pos = pos
        
        start = found_pos
        end = found_pos + len(t_str)
        tokens.append({
            "text": t_str,
            "start": start,
            "end": end,
            "id": idx,
            "ws": False
        })
        pos = end
    
    for i in range(len(tokens) - 1):
        cur_end = tokens[i]["end"]
        next_start = tokens[i + 1]["start"]
        if next_start > cur_end:
            tokens[i]["ws"] = True
            
    return tokens

def bio_tags_to_spans(tokens, ner_tags, full_text=None, id_to_tag=None):
    """
    Converts BIO tags (strings or integer IDs) and tokens to character and token spans.
    """
    if id_to_tag is None:
        id_to_tag = DEFAULT_ID_TO_TAG

    # Normalize integer tags to string tags
    str_tags = []
    for tag in ner_tags:
        if isinstance(tag, int):
            str_tags.append(id_to_tag.get(tag, "O"))
        else:
            str_tags.append(str(tag))

    spans = []
    in_entity = False
    cur_label = ""
    cur_tok_start = 0
    cur_tok_end = 0

    for i, tag in enumerate(str_tags):
        if tag.startswith("B-"):
            if in_entity:
                spans.append({
                    "token_start": cur_tok_start,
                    "token_end": cur_tok_end,
                    "label": cur_label
                })
            in_entity = True
            cur_label = tag[2:]
            cur_tok_start = i
            cur_tok_end = i
        elif tag.startswith("I-"):
            tag_label = tag[2:]
            if in_entity and tag_label == cur_label:
                cur_tok_end = i
            else:
                if in_entity:
                    spans.append({
                        "token_start": cur_tok_start,
                        "token_end": cur_tok_end,
                        "label": cur_label
                    })
                in_entity = True
                cur_label = tag_label
                cur_tok_start = i
                cur_tok_end = i
        else: # "O"
            if in_entity:
                spans.append({
                    "token_start": cur_tok_start,
                    "token_end": cur_tok_end,
                    "label": cur_label
                })
                in_entity = False

    if in_entity:
        spans.append({
            "token_start": cur_tok_start,
            "token_end": cur_tok_end,
            "label": cur_label
        })

    # Enrich spans with char offsets and entity text
    enriched_spans = []
    for s in spans:
        t_start = s["token_start"]
        t_end = s["token_end"]
        
        if 0 <= t_start < len(tokens) and 0 <= t_end < len(tokens):
            c_start = tokens[t_start]["start"]
            c_end = tokens[t_end]["end"]
            
            if full_text and c_end <= len(full_text):
                ent_text = full_text[c_start:c_end]
            else:
                ent_text = " ".join(tokens[k]["text"] for k in range(t_start, t_end + 1))
            
            enriched_spans.append({
                "start": c_start,
                "end": c_end,
                "token_start": t_start,
                "token_end": t_end,
                "label": s["label"],
                "text": ent_text
            })

    return enriched_spans, str_tags

def spans_to_bracket_text(clean_text, spans):
    """
    Reconstructs bracket-annotated text e.g. [Entity]LABEL from clean text and spans.
    """
    sorted_spans = sorted(spans, key=lambda s: s["start"])
    result = ""
    last_idx = 0
    for s in sorted_spans:
        result += clean_text[last_idx:s["start"]]
        ent_text = s.get("text", clean_text[s["start"]:s["end"]])
        result += f"[{ent_text}]{s['label']}"
        last_idx = s["end"]
    result += clean_text[last_idx:]
    return result

def parse_record(line_str, labels="PER|LOC|ORG|DATE", signed_hash=True, default_id=0):
    """
    Parses a single record from CSV, BIO JSON, Prodigy JSONL, or Bracket text.
    """
    line_str = line_str.strip()
    if not line_str:
        return None

    # Check if header line in CSV
    if line_str.replace('"', '').strip() == "id,tokens,ner_tags":
        return None

    data = None
    is_csv_row = False

    # Check if CSV line: e.g. "0","['Pupunan','nin',...]","[0,0,0,...]"
    if line_str.startswith('"') and '",' in line_str:
        try:
            reader = csv.reader(io.StringIO(line_str))
            row = next(reader)
            if len(row) >= 3:
                rec_id = row[0]
                tokens_raw = row[1]
                ner_tags_raw = row[2]
                
                # Parse python/json list syntax
                try:
                    tokens_list = ast.literal_eval(tokens_raw) if tokens_raw.startswith('[') else json.loads(tokens_raw)
                except Exception:
                    tokens_list = [t.strip("'\"") for t in tokens_raw.strip('[]').split(',') if t.strip()]
                    
                try:
                    tags_list = ast.literal_eval(ner_tags_raw) if ner_tags_raw.startswith('[') else json.loads(ner_tags_raw)
                except Exception:
                    tags_list = [t.strip("'\"") for t in ner_tags_raw.strip('[]').split(',') if t.strip()]
                    tags_list = [int(t) if t.isdigit() else t for t in tags_list]
                    
                data = {
                    "id": rec_id,
                    "tokens": tokens_list,
                    "ner_tags": tags_list
                }
                is_csv_row = True
        except Exception:
            data = None

    if data is None:
        if line_str.startswith('{') and line_str.endswith('}'):
            try:
                data = json.loads(line_str)
            except Exception:
                data = {"text": line_str}
        else:
            data = {"text": line_str}

    # Detect Input Format
    is_bio_format = is_csv_row or ("ner_tags" in data and ("tokens" in data or "spans" in data or "text" in data))
    is_prodigy_format = "tokens" in data and isinstance(data.get("tokens"), list) and len(data["tokens"]) > 0 and isinstance(data["tokens"][0], dict) and "spans" in data

    doc_id = data.get("document_id", "")
    order_val = data.get("order", default_id)
    rec_id = str(data.get("id", default_id))

    if is_bio_format:
        raw_tokens = data.get("tokens", [])
        raw_ner_tags = data.get("ner_tags", [])
        text = data.get("text", "")
        
        if raw_tokens and isinstance(raw_tokens[0], str):
            token_texts = raw_tokens
        elif raw_tokens and isinstance(raw_tokens[0], dict):
            token_texts = [t.get("text", "") for t in raw_tokens]
        else:
            token_texts = []

        if not text and token_texts:
            text = " ".join(token_texts)
        
        tokens = align_tokens_to_text(token_texts, text)
        spans, str_ner_tags = bio_tags_to_spans(tokens, raw_ner_tags, text)
        ner_tags_int = [DEFAULT_TAG_TO_ID.get(t, 0) if isinstance(t, str) else t for t in raw_ner_tags]

        bracket_text = spans_to_bracket_text(text, spans)
        clean_text = text

    elif is_prodigy_format:
        clean_text = data.get("text", "")
        tokens = data.get("tokens", [])
        spans_in = data.get("spans", [])
        
        spans = []
        for s in spans_in:
            ent_text = clean_text[s["start"]:s["end"]] if "start" in s and "end" in s else s.get("text", "")
            spans.append({
                "start": s.get("start", 0),
                "end": s.get("end", 0),
                "token_start": s.get("token_start", 0),
                "token_end": s.get("token_end", 0),
                "label": s.get("label", "ENTITY"),
                "text": ent_text
            })

        # Generate BIO tags
        str_ner_tags = []
        ner_tags_int = []
        for t in tokens:
            t_id = t.get("id", 0)
            matched = next((s for s in spans if s["token_start"] <= t_id <= s["token_end"]), None)
            if not matched:
                str_ner_tags.append("O")
                ner_tags_int.append(0)
            elif t_id == matched["token_start"]:
                tag_name = f"B-{matched['label']}"
                str_ner_tags.append(tag_name)
                ner_tags_int.append(DEFAULT_TAG_TO_ID.get(tag_name, 0))
            else:
                tag_name = f"I-{matched['label']}"
                str_ner_tags.append(tag_name)
                ner_tags_int.append(DEFAULT_TAG_TO_ID.get(tag_name, 0))

        bracket_text = spans_to_bracket_text(clean_text, spans)

    else:
        # Bracket-Annotated Format
        raw_text = data.get("text", "")
        if not raw_text:
            return None

        pattern = re.compile(rf'\[(.*?)\]({labels}|[A-Za-z0-9_]+)')
        clean_text = ""
        extracted_spans = []
        current_idx = 0

        for match in pattern.finditer(raw_text):
            start, end = match.span()
            entity_text = match.group(1)
            label = match.group(2)

            clean_text += raw_text[current_idx:start]
            span_start = len(clean_text)
            clean_text += entity_text
            span_end = len(clean_text)

            extracted_spans.append({
                "start": span_start,
                "end": span_end,
                "label": label,
                "text": entity_text
            })
            current_idx = end
        clean_text += raw_text[current_idx:]

        tokens = tokenize_text(clean_text)

        # Map char spans to token spans
        spans = []
        for s in extracted_spans:
            t_start, t_end = None, None
            for t in tokens:
                if t['start'] == s['start'] or (t['start'] > s['start'] and t_start is None):
                    t_start = t['id']
                if t['end'] == s['end'] or (t['end'] > s['end'] and t_end is None):
                    t_end = t['id']
            if t_start is not None and t_end is not None:
                spans.append({
                    "start": s['start'],
                    "end": s['end'],
                    "token_start": t_start,
                    "token_end": t_end,
                    "label": s['label'],
                    "text": s['text']
                })

        str_ner_tags = []
        ner_tags_int = []
        for t in tokens:
            matched = next((s for s in spans if s['token_start'] <= t['id'] <= s['token_end']), None)
            if not matched:
                str_ner_tags.append('O')
                ner_tags_int.append(0)
            elif t['id'] == matched['token_start']:
                tag_name = f"B-{matched['label']}"
                str_ner_tags.append(tag_name)
                ner_tags_int.append(DEFAULT_TAG_TO_ID.get(tag_name, 0))
            else:
                tag_name = f"I-{matched['label']}"
                str_ner_tags.append(tag_name)
                ner_tags_int.append(DEFAULT_TAG_TO_ID.get(tag_name, 0))

        bracket_text = raw_text

    # Extract token text list
    token_str_list = [t["text"] if isinstance(t, dict) else str(t) for t in tokens]

    # Build Standard BIO Format Entry with Integer Tags
    bio_entry_int = {
        "id": rec_id,
        "document_id": doc_id,
        "order": order_val,
        "text": clean_text,
        "tokens": token_str_list,
        "ner_tags": ner_tags_int,
        "spans": spans
    }

    # Build Standard BIO Format Entry with String Tags
    bio_entry_str = {
        "id": rec_id,
        "document_id": doc_id,
        "order": order_val,
        "text": clean_text,
        "tokens": token_str_list,
        "ner_tags": str_ner_tags,
        "spans": spans
    }

    # Build CSV Row Entry: "id","tokens","ner_tags"
    # tokens formatted as Python list string: "['Pupunan','nin',...]"
    # ner_tags formatted as integer list string: "[0,0,0,5,6,...]"
    csv_tokens_str = "[" + ",".join([f"'{t}'" for t in token_str_list]) + "]"
    csv_tags_str = "[" + ",".join([str(tag) for tag in ner_tags_int]) + "]"
    csv_row_str = f'"{rec_id}","{csv_tokens_str}","{csv_tags_str}"'

    # Build Prodigy Entry
    input_h = to_int32(hash(clean_text)) if signed_hash else (hash(clean_text) & 0xffffffff)
    task_h = to_int32(hash(bracket_text)) if signed_hash else (hash(bracket_text) & 0xffffffff)
    annotator_time = get_timestamp_str()

    prodigy_entry = {
        "text": clean_text,
        "document_id": doc_id,
        "order": order_val,
        "_input_hash": input_h,
        "_task_hash": task_h,
        "_is_binary": False,
        "tokens": tokens,
        "_view_id": "ner_manual",
        "spans": [{"start": s["start"], "end": s["end"], "token_start": s["token_start"], "token_end": s["token_end"], "label": s["label"]} for s in spans],
        "answer": "accept",
        "_timestamp": int(time.time()),
        "_annotator_id": annotator_time,
        "_session_id": annotator_time
    }

    # Build Bracket Entry
    bracket_entry = {
        "text": bracket_text,
        "document_id": doc_id,
        "order": order_val
    }

    return {
        "bio": bio_entry_int,
        "bio_str": bio_entry_str,
        "csv_row": csv_row_str,
        "prodigy": prodigy_entry,
        "bracket": bracket_entry,
        "clean_text": clean_text,
        "bracket_text": bracket_text,
        "tokens": tokens,
        "token_texts": token_str_list,
        "spans": spans,
        "ner_tags_int": ner_tags_int,
        "ner_tags_str": str_ner_tags,
        "id": rec_id
    }

def parse_bracket_annotations(input_file_or_data, output_file=None, labels="PER|LOC|ORG|DATE", schema_format="bio_csv", signed_hash=True, compact=False):
    """
    Parses input file/lines in any format, and exports to the selected schema format:
    - 'bio_csv' / 'csv': "id","tokens","ner_tags" format
    - 'bio': BIO Format JSON with integer ner_tags e.g. [0, 5, 6, 7]
    - 'bio_str': BIO Format JSON with string ner_tags e.g. ["O", "B-LOC", "I-LOC"]
    - 'prodigy': Prodigy ner_manual JSONL
    - 'bracket': Bracket-annotated JSONL
    """
    results = []
    rec_count = 0

    def handle_line(line):
        nonlocal rec_count
        rec = parse_record(line, labels=labels, signed_hash=signed_hash, default_id=rec_count)
        if rec:
            rec_count += 1
            results.append(rec)

    if isinstance(input_file_or_data, str):
        with open(input_file_or_data, 'r', encoding='utf-8') as f_in:
            for line in f_in:
                handle_line(line)
    else:
        for line in input_file_or_data:
            handle_line(line)

    if output_file:
        with open(output_file, 'w', encoding='utf-8', newline='') as f_out:
            if schema_format in ["bio_csv", "csv"]:
                f_out.write('"id","tokens","ner_tags"\n')
                for item in results:
                    f_out.write(item["csv_row"] + '\n')
            elif schema_format == "bio":
                for item in results:
                    f_out.write(json.dumps(item["bio"], ensure_ascii=False, separators=(',', ':') if compact else None) + '\n')
            elif schema_format == "bio_str":
                for item in results:
                    f_out.write(json.dumps(item["bio_str"], ensure_ascii=False, separators=(',', ':') if compact else None) + '\n')
            elif schema_format == "prodigy":
                for item in results:
                    f_out.write(json.dumps(item["prodigy"], ensure_ascii=False, separators=(',', ':') if compact else None) + '\n')
            elif schema_format == "bracket":
                for item in results:
                    f_out.write(json.dumps(item["bracket"], ensure_ascii=False, separators=(',', ':') if compact else None) + '\n')
            else:
                for item in results:
                    f_out.write(json.dumps(item["bio"], ensure_ascii=False) + '\n')
        print(f"Successfully processed {len(results)} records ({schema_format.upper()} format) -> {output_file}")
    
    return results

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Universal NER Parser & Converter: BIO CSV (\"id\",\"tokens\",\"ner_tags\") <-> BIO JSON <-> Prodigy JSONL <-> Bracket Text")
    parser.add_argument('-i', '--input', help="Input file (CSV, JSONL, or TXT)", default="sample_data.jsonl")
    parser.add_argument('-o', '--output', help="Output file", default="bio_dataset.csv")
    parser.add_argument('-f', '--format', choices=['bio_csv', 'csv', 'bio', 'bio_str', 'prodigy', 'bracket'], default='bio_csv', help="Output format schema (default: bio_csv)")
    parser.add_argument('-l', '--labels', help="Regex pipe-delimited labels (e.g. PER|LOC|ORG|DATE)", default="PER|LOC|ORG|DATE")
    parser.add_argument('--signed-hash', action='store_true', default=True, help="Use signed 32-bit integer for hashes (Prodigy format)")
    parser.add_argument('--compact', action='store_true', default=True, help="Use compact JSON output (no spaces)")
    
    args = parser.parse_args()
    parse_bracket_annotations(args.input, args.output, args.labels, args.format, args.signed_hash, args.compact)
