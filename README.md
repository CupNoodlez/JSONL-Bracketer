# 🏷️ Bracketer - Universal NER Annotation Engine & Converter

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.7+](https://img.shields.io/badge/Python-3.7+-3776AB.svg?logo=python&logoColor=white)](bracket_parser.py)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero%20External-success.svg)](bracket_parser.py)
[![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS%20%2F%20HTML5%20%2F%20CSS3-F7DF1E.svg?logo=javascript&logoColor=black)](index.html)

**Bracketer** is a dual-interface toolkit (interactive Web Studio + standalone Python CLI) designed for NLP researchers, data annotators, and machine learning engineers. It enables seamless bidirectional conversion, visual inspection, and editing across **BIO CSV datasets** (`"id","tokens","ner_tags"`), **BIO JSON**, **Prodigy `ner_manual` JSONL**, and **Bracket-annotated text** (`[Entity]LABEL`).

---

## ✨ Features

- 🔄 **Universal Bidirectional Conversion**:
  - Convert effortlessly between **BIO CSV** (Hugging Face Datasets / CoNLL standard), **BIO JSON**, **Prodigy JSONL**, and **Bracket Annotation format**.
- 🖥️ **Interactive Web Application**:
  - **Live Visual Span Inspector & Editor**: Real-time token highlighting and interactive entity tagging.
  - **In-Browser Schema Switching**: Switch output schemas on the fly between BIO CSV, BIO JSON (integer/string tags), Prodigy, and Bracket JSONL.
  - **Preset Sample Datasets**: Built-in samples for BicolaNER (*Kasanggayahan Festival*, *Bulusan/Sorsogon*), Multilingual Tech, and History records.
  - **Local Session Persistence**: Automatically persists active session state and custom tags in browser `localStorage`.
  - **Instant Export**: One-click dataset downloads and clipboard copy.
- ⚡ **Zero-Dependency Python CLI (`bracket_parser.py`)**:
  - Built entirely using Python standard library modules (`re`, `json`, `csv`, `argparse`).
  - Command-line utility for batch conversion and automation in data pipelines.
  - Callable Python module for programmatic integration with PyTorch, spaCy, or Hugging Face `transformers`.
- 🏷️ **Comprehensive NER Tag Schemas**:
  - Standard integer and string BIO tag mappings (`O: 0`, `B-PER: 1`, `I-PER: 2`, `B-ORG: 3`, `I-ORG: 4`, `B-LOC: 5`, `I-LOC: 6`, `B-DATE: 7`, `I-DATE: 8`).
  - Dynamic ID allocation for custom entity labels.
- 🎯 **Accurate Offsets & Alignment**:
  - Automatic tokenization, character-to-token offset calculation, and Prodigy hash generator (`_input_hash`, `_task_hash`).

---

## 📋 Supported Formats

| Format | Description | Target Use Case |
|---|---|---|
| **BIO CSV** | `"id","tokens","ner_tags"` with integer lists or string tags | Hugging Face `datasets`, PyTorch Datasets, CoNLL benchmarks |
| **BIO JSON** | Structured JSON with `tokens`, `ner_tags`, `spans`, and `text` | Custom NLP training pipelines, document-level metadata |
| **Prodigy JSONL** | `ner_manual` format with `_input_hash`, `_task_hash`, `tokens`, and `spans` | spaCy Prodigy annotation workflows and active learning |
| **Bracket Text / JSONL** | `[Entity Text]LABEL` inline bracket syntax | Human-friendly text annotation, quick LLM prompt generation |

---

## 🏷️ Standard Tag Mapping

By default, Bracketer implements the standard 9-class BIO schema:

| Integer ID | BIO Tag | Description |
|:---:|:---:|:---|
| `0` | `O` | Outside any named entity |
| `1` | `B-PER` | Beginning of a Person entity |
| `2` | `I-PER` | Inside a Person entity |
| `3` | `B-ORG` | Beginning of an Organization entity |
| `4` | `I-ORG` | Inside an Organization entity |
| `5` | `B-LOC` | Beginning of a Location entity |
| `6` | `I-LOC` | Inside a Location entity |
| `7` | `B-DATE` | Beginning of a Date entity |
| `8` | `I-DATE` | Inside a Date entity |

*Custom labels added in the UI or CLI are automatically assigned incremental integer IDs (e.g. `9`, `10`, etc.).*

---

## 🚀 Quick Start

### 1. Using the Web Interface

No installation or build step is required. Open `index.html` in any modern web browser:

```bash
# Option A: Direct file open
# Simply double click 'index.html' or open it in your browser

# Option B: Run a local static server
python -m http.server 8000
# Then visit http://localhost:8000
```

#### Web Studio Features:
1. **Paste or Upload**: Paste your raw bracket annotations, BIO CSV, BIO JSON, or Prodigy JSONL into the editor.
2. **Select Schema**: Choose your target export schema (**BIO CSV**, **BIO JSON**, **Prodigy JSONL**, or **Bracket JSONL**).
3. **Visual Tagging**: Click on tokens in the Visual Studio to apply, edit, or remove entity tags.
4. **Export**: Click **Download** or **Copy Output** to export your formatted dataset.

---

### 2. Using the Python CLI (`bracket_parser.py`)

The CLI script runs out-of-the-box with Python 3.7+ without installing third-party packages.

#### Command-Line Syntax
```bash
python bracket_parser.py -i <input_file> -o <output_file> -f <format> [options]
```

#### Available Arguments
- `-i, --input`: Path to input file (`.csv`, `.jsonl`, or `.txt`) *(Default: `sample_data.jsonl`)*.
- `-o, --output`: Path to output file *(Default: `bio_dataset.csv`)*.
- `-f, --format`: Output format schema:
  - `bio_csv` (or `csv`): `"id","tokens","ner_tags"` CSV format.
  - `bio`: JSONL with integer `ner_tags` (e.g. `[0, 5, 6, 7]`).
  - `bio_str`: JSONL with string `ner_tags` (e.g. `["O", "B-LOC", "I-LOC"]`).
  - `prodigy`: Prodigy `ner_manual` JSONL format.
  - `bracket`: Bracket-annotated JSONL format.
- `-l, --labels`: Pipe-delimited regex pattern for recognizable entity labels *(Default: `PER|LOC|ORG|DATE`)*.
- `--compact`: Output minified single-line JSON records *(Default: `True`)*.

---

## 💡 Examples & Conversions

### Example 1: Convert Bracket Text to BIO CSV for Hugging Face

**Input (`sample_data.jsonl`):**
```json
{"text": "Nagtatrabaho si [Maria Santos]PER sa [Google]ORG sa syudad kan [Mountain View]LOC puon pa kan [Enero 2021]DATE.", "document_id": "bicolmail_160", "order": 12}
```

**Run Command:**
```bash
python bracket_parser.py -i sample_data.jsonl -o dataset.csv -f bio_csv
```

**Output (`dataset.csv`):**
```csv
"id","tokens","ner_tags"
"bicolmail_160_12","['Nagtatrabaho','si','Maria','Santos','sa','Google','sa','syudad','kan','Mountain','View','puon','pa','kan','Enero','2021','.']","[0,0,1,2,0,3,0,0,0,5,6,0,0,0,7,8,0]"
```

---

### Example 2: Convert BIO CSV to Prodigy JSONL

**Run Command:**
```bash
python bracket_parser.py -i dataset.csv -o prodigy_data.jsonl -f prodigy
```

**Output (`prodigy_data.jsonl`):**
```json
{"text":"Nagtatrabaho si Maria Santos sa Google sa syudad kan Mountain View puon pa kan Enero 2021.","_input_hash":-1834928123,"_task_hash":1928472910,"tokens":[{"text":"Nagtatrabaho","start":0,"end":12,"id":0,"ws":true},{"text":"si","start":13,"end":15,"id":1,"ws":true},{"text":"Maria","start":16,"end":21,"id":2,"ws":true},{"text":"Santos","start":22,"end":28,"id":3,"ws":true},{"text":"sa","start":29,"end":31,"id":4,"ws":true},{"text":"Google","start":32,"end":38,"id":5,"ws":true},{"text":"sa","start":39,"end":41,"id":6,"ws":true},{"text":"syudad","start":42,"end":48,"id":7,"ws":true},{"text":"kan","start":49,"end":52,"id":8,"ws":true},{"text":"Mountain","start":53,"end":61,"id":9,"ws":true},{"text":"View","start":62,"end":66,"id":10,"ws":true},{"text":"puon","start":67,"end":71,"id":11,"ws":true},{"text":"pa","start":72,"end":74,"id":12,"ws":true},{"text":"kan","start":75,"end":78,"id":13,"ws":true},{"text":"Enero","start":79,"end":84,"id":14,"ws":true},{"text":"2021","start":85,"end":89,"id":15,"ws":false},{"text":".","start":89,"end":90,"id":16,"ws":false}],"spans":[{"start":16,"end":28,"token_start":2,"token_end":3,"label":"PER","text":"Maria Santos"},{"start":32,"end":38,"token_start":5,"token_end":5,"label":"ORG","text":"Google"},{"start":53,"end":66,"token_start":9,"token_end":10,"label":"LOC","text":"Mountain View"},{"start":79,"end":89,"token_start":14,"token_end":15,"label":"DATE","text":"Enero 2021"}],"meta":{"id":"bicolmail_160_12","document_id":"bicolmail_160","order":12},"_session_id":null,"_annotator_id":null,"_view_id":"ner_manual","answer":"accept"}
```

---

### Example 3: Programmatic Python Usage

```python
from bracket_parser import parse_record, parse_bracket_annotations

# 1. Parse a single record
raw_line = '{"text": "Apple announced that Tim Cook visited Tokyo on [September 15, 2025]DATE.", "document_id": "doc1", "order": 1}'
record = parse_record(raw_line)

print("Tokens:", record["tokens"])
print("BIO Tags (IDs):", record["ner_tags_int"])
print("BIO Tags (Strings):", record["ner_tags_str"])
print("Extracted Spans:", record["spans"])

# 2. Batch process an entire file
results = parse_bracket_annotations(
    input_file_or_data="sample_data.jsonl",
    output_file="output_bio.jsonl",
    schema_format="bio"
)
```

---

## 📁 Repository Structure

```
JSONL-Bracketer/
├── index.html            # Main web application UI
├── styles.css            # Responsive dark-mode styling & design system
├── app.js                # Core JavaScript parser, editor, and reactive engine
├── bracket_parser.py     # Standalone Python CLI & converter script
├── sample_data.jsonl     # Sample Bracket-annotated dataset
├── bio_format.jsonl      # Sample BIO JSON dataset
├── prodigy_format.jsonl  # Sample Prodigy ner_manual dataset
├── .gitignore            # Git ignore rules for Python & OS files
├── LICENSE               # MIT Open Source License
└── README.md             # Project documentation
```
---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
