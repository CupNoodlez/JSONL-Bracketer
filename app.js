/**
 * app.js - Universal Bracket, BIO Format ("id","tokens","ner_tags") & Prodigy NER Dataset Engine
 */

// LocalStorage Persistence Key
const STORAGE_KEY = 'bracketer_session_v3';

// Default Tag-to-Integer ID Mapping (BicolaNER / CoNLL Standard)
const DEFAULT_TAG_TO_ID = {
  'O': 0,
  'B-PER': 1,
  'I-PER': 2,
  'B-ORG': 3,
  'I-ORG': 4,
  'B-LOC': 5,
  'I-LOC': 6,
  'B-DATE': 7,
  'I-DATE': 8
};

const DEFAULT_ID_TO_TAG = {
  0: 'O',
  1: 'B-PER',
  2: 'I-PER',
  3: 'B-ORG',
  4: 'I-ORG',
  5: 'B-LOC',
  6: 'I-LOC',
  7: 'B-DATE',
  8: 'I-DATE'
};

// Dynamic tag ID lookup
function getTagId(tagName) {
  if (tagName in DEFAULT_TAG_TO_ID) {
    return DEFAULT_TAG_TO_ID[tagName];
  }
  // Auto-allocate ID for new custom tags
  let maxId = 8;
  for (const k in DEFAULT_TAG_TO_ID) {
    if (DEFAULT_TAG_TO_ID[k] > maxId) maxId = DEFAULT_TAG_TO_ID[k];
  }
  DEFAULT_TAG_TO_ID[tagName] = maxId + 1;
  DEFAULT_ID_TO_TAG[maxId + 1] = tagName;
  return DEFAULT_TAG_TO_ID[tagName];
}

function getTagNameFromId(tagId) {
  const numId = Number(tagId);
  if (numId in DEFAULT_ID_TO_TAG) {
    return DEFAULT_ID_TO_TAG[numId];
  }
  return 'O';
}

// Application State
const state = {
  activeLabels: ['PER', 'LOC', 'ORG', 'DATE'],
  records: [],
  annotatorId: '',
  sessionId: '',
  useSignedHash: true,
  schemaFormat: 'bio_csv', // 'bio_csv' ("id","tokens","ner_tags"), 'bio' (int tags), 'bio_str', 'prodigy', 'bracket'
  outputFormat: 'compact', // 'compact' or 'pretty'
  timestampFormat: 'datetime', // 'datetime' (YYYY-MM-DD_HH-mm-ss) or 'date' (YYYY-MM-DD)
  activeTab: 'visual'
};

// Preset Sample Datasets
const SAMPLE_DATASETS = {
  kasanggayahan: `"id","tokens","ner_tags"
"0","['Pupunan','nin','sarong','banal','na','misa','na','gigibuhon','sa','Gibalon','Shrine','sa','Brgy','.','Siuton',',','Magallanes',',','Sorsogon','an','selebrasyon','kan','Kasanggayahan','Festival','2022','.']","[0,0,0,0,0,0,0,0,0,5,6,0,5,6,6,6,6,6,6,0,0,0,0,0,7,0]"
"1","['Nagtatrabaho','si','Maria','Santos','sa','Google','sa','syudad','kan','Mountain','View','puon','pa','kan','Enero','2021','.']","[0,0,1,2,0,3,0,0,0,5,6,0,0,0,7,8,0]"
"2","['Apple','Inc','.','announced','that','Tim','Cook','visited','Tokyo','on','September','15',',','2025','.']","[3,4,4,0,0,1,2,0,5,0,7,8,8,8,0]"`,

  bio: `{"id":"0","tokens":["Pupunan","nin","sarong","banal","na","misa","na","gigibuhon","sa","Gibalon","Shrine","sa","Brgy",".","Siuton",",","Magallanes",",","Sorsogon","an","selebrasyon","kan","Kasanggayahan","Festival","2022","."],"ner_tags":[0,0,0,0,0,0,0,0,0,5,6,0,5,6,6,6,6,6,6,0,0,0,0,0,7,0]}
{"id":"1","tokens":["Kinumpirmar","mismo","kan","mga","kapamilya","kan","biktima","na","ang","nakuang","bangkay","iyo","an","saindang","kapamilya","na","nawawara","puon","pa","kan","Enero","28","sa","kadagatan","na","sakop","kan","Bulusan",",","Sorsogon","."],"ner_tags":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,8,0,0,0,0,0,5,6,6,0]}`,

  bicoldot5: `{"text": "Kinumpirmar mismo kan mga kapamilya kan biktima na ang nakuang bangkay iyo an saindang kapamilya na nawawara puon pa kan [Enero 28]DATE sa kadagatan na sakop kan [Bulusan, Sorsogon]LOC.", "document_id": "bicoldot_5", "order": 3}`,

  bicol159: `{"text": "[Magduduwang taon]DATE na an pandemya bako lang digdi sa [Pilipinas]LOC kundi sa ibang parte kan kinaban maski sa [Amerika]LOC, sa [Europa]LOC, sa [Australia]LOC, asin dakul na parte kan [Asya]LOC.", "document_id": "bicolmail_159", "order": 11}
{"text": "Nagtatrabaho si [Maria Santos]PER sa [Google]ORG sa syudad kan [Mountain View]LOC puon pa kan [Enero 2021]DATE.", "document_id": "bicolmail_160", "order": 12}`,

  prodigy: `{"text": "Apple Inc. announced that Tim Cook visited Tokyo on September 15, 2025 for the annual tech summit.", "document_id": "tech_news_01", "order": 1, "_input_hash": 3052141510, "_task_hash": 1418940964, "_is_binary": false, "tokens": [{"text": "Apple", "start": 0, "end": 5, "id": 0, "ws": true}, {"text": "Inc", "start": 6, "end": 9, "id": 1, "ws": false}, {"text": ".", "start": 9, "end": 10, "id": 2, "ws": true}, {"text": "announced", "start": 11, "end": 20, "id": 3, "ws": true}, {"text": "that", "start": 21, "end": 25, "id": 4, "ws": true}, {"text": "Tim", "start": 26, "end": 29, "id": 5, "ws": true}, {"text": "Cook", "start": 30, "end": 34, "id": 6, "ws": true}, {"text": "visited", "start": 35, "end": 42, "id": 7, "ws": true}, {"text": "Tokyo", "start": 43, "end": 48, "id": 8, "ws": true}, {"text": "on", "start": 49, "end": 51, "id": 9, "ws": true}, {"text": "September", "start": 52, "end": 61, "id": 10, "ws": true}, {"text": "15", "start": 62, "end": 64, "id": 11, "ws": false}, {"text": ",", "start": 64, "end": 65, "id": 12, "ws": true}, {"text": "2025", "start": 66, "end": 70, "id": 13, "ws": true}, {"text": "for", "start": 71, "end": 74, "id": 14, "ws": true}, {"text": "the", "start": 75, "end": 78, "id": 15, "ws": true}, {"text": "annual", "start": 79, "end": 85, "id": 16, "ws": true}, {"text": "tech", "start": 86, "end": 90, "id": 17, "ws": true}, {"text": "summit", "start": 91, "end": 97, "id": 18, "ws": false}, {"text": ".", "start": 97, "end": 98, "id": 19, "ws": false}], "_view_id": "ner_manual", "spans": [{"start": 0, "end": 10, "token_start": 0, "token_end": 2, "label": "ORG"}, {"start": 26, "end": 34, "token_start": 5, "token_end": 6, "label": "PER"}, {"start": 43, "end": 48, "token_start": 8, "token_end": 8, "label": "LOC"}, {"start": 52, "end": 70, "token_start": 10, "token_end": 13, "label": "DATE"}], "answer": "accept", "_timestamp": 1788663082, "_annotator_id": "2026-09-06", "_session_id": "2026-09-06"}`,

  multilingual: `{"text": "[Apple Inc.]ORG announced that CEO [Tim Cook]PER visited [Tokyo]LOC on [September 15, 2025]DATE for the new tech summit.", "document_id": "tech_news_01", "order": 1}
{"text": "Founded in [1998]DATE by [Larry Page]PER and [Sergey Brin]PER, [Google]ORG changed search technology across [North America]LOC and [Europe]LOC.", "document_id": "tech_history_02", "order": 2}
{"text": "Si [Jose Rizal]PER namundag sa [Calamba, Laguna]LOC kan [Hunyo 19, 1861]DATE.", "document_id": "ph_history_03", "order": 3}`,

  rawText: `[Barack Obama]PER was the 44th president of the [United States]LOC from [2009]DATE to [2017]DATE.
[Microsoft]ORG was established in [Albuquerque, New Mexico]LOC on [April 4, 1975]DATE by [Bill Gates]PER.`
};

// Formats timestamp as YYYY-MM-DD_HH-mm-ss or YYYY-MM-DD
function getFormattedTimestamp(type = 'datetime', dateObj = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = dateObj.getFullYear();
  const month = pad(dateObj.getMonth() + 1);
  const day = pad(dateObj.getDate());
  
  if (type === 'date') {
    return `${year}-${month}-${day}`;
  }
  
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());
  const seconds = pad(dateObj.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// 32-bit Hash computation
function hashString32(str, signed = true) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return signed ? (hash | 0) : (hash >>> 0);
}

// Helper to parse Python / JS list string e.g. "['a', 'b']" or "[0, 5, 6]"
function parseListString(str) {
  if (!str) return [];
  const trimmed = str.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      // Try JSON first (e.g. ["a", "b"])
      return JSON.parse(trimmed.replace(/'/g, '"'));
    } catch (e) {
      // Manual regex fallback for Python list format e.g. ['Pupunan', 'nin']
      const inner = trimmed.slice(1, -1);
      const items = [];
      const regex = /(?:'([^']*)')|(?:"([^"]*)")|([^,\s]+)/g;
      let m;
      while ((m = regex.exec(inner)) !== null) {
        if (m[1] !== undefined) items.push(m[1]);
        else if (m[2] !== undefined) items.push(m[2]);
        else if (m[3] !== undefined) {
          const val = m[3].trim();
          items.push(/^\d+$/.test(val) ? parseInt(val, 10) : val);
        }
      }
      return items;
    }
  }
  return [trimmed];
}

// Helper to parse CSV line containing quoted items
function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur);
  return result;
}

// Tokenize clean text into spaCy/Prodigy compliant token array
function tokenizeCleanText(cleanText) {
  const tokens = [];
  const tokenRegex = /\S+|\s+/g;
  let tokenId = 0;
  let pos = 0;
  let m;

  while ((m = tokenRegex.exec(cleanText)) !== null) {
    const tStr = m[0];
    if (/^\s+$/.test(tStr)) {
      if (tokens.length > 0) {
        tokens[tokens.length - 1].ws = true;
      }
      pos += tStr.length;
      continue;
    }

    const punctSplit = /[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]/gu;
    let pt;
    while ((pt = punctSplit.exec(tStr)) !== null) {
      const ptStr = pt[0];
      tokens.push({
        text: ptStr,
        start: pos,
        end: pos + ptStr.length,
        id: tokenId,
        ws: false
      });
      pos += ptStr.length;
      tokenId++;
    }
  }

  return tokens;
}

// Align token strings to full text
function alignTokenStringsToText(tokenTexts, fullText) {
  const tokens = [];
  let pos = 0;

  for (let idx = 0; idx < tokenTexts.length; idx++) {
    const tStr = String(tokenTexts[idx]);
    let foundPos = fullText.indexOf(tStr, pos);
    if (foundPos === -1) {
      foundPos = pos;
    }
    const start = foundPos;
    const end = foundPos + tStr.length;
    tokens.push({
      text: tStr,
      start: start,
      end: end,
      id: idx,
      ws: false
    });
    pos = end;
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i + 1].start > tokens[i].end) {
      tokens[i].ws = true;
    }
  }

  return tokens;
}

// Convert BIO tags (integers or strings) and token array to spans
function bioTagsToSpans(tokens, nerTags, fullText = '') {
  // Normalize tags to string representation
  const strTags = nerTags.map(tag => {
    if (typeof tag === 'number') {
      return getTagNameFromId(tag);
    }
    return String(tag);
  });

  const rawSpans = [];
  let inEntity = false;
  let curLabel = '';
  let curTokStart = 0;
  let curTokEnd = 0;

  for (let i = 0; i < strTags.length; i++) {
    const tag = strTags[i] || 'O';
    if (tag.startsWith('B-')) {
      if (inEntity) {
        rawSpans.push({ token_start: curTokStart, token_end: curTokEnd, label: curLabel });
      }
      inEntity = true;
      curLabel = tag.slice(2);
      curTokStart = i;
      curTokEnd = i;
    } else if (tag.startsWith('I-')) {
      const tagLabel = tag.slice(2);
      if (inEntity && tagLabel === curLabel) {
        curTokEnd = i;
      } else {
        if (inEntity) {
          rawSpans.push({ token_start: curTokStart, token_end: curTokEnd, label: curLabel });
        }
        inEntity = true;
        curLabel = tagLabel;
        curTokStart = i;
        curTokEnd = i;
      }
    } else {
      if (inEntity) {
        rawSpans.push({ token_start: curTokStart, token_end: curTokEnd, label: curLabel });
        inEntity = false;
      }
    }
  }

  if (inEntity) {
    rawSpans.push({ token_start: curTokStart, token_end: curTokEnd, label: curLabel });
  }

  // Enrich spans with char offsets and entity text
  const enriched = [];
  rawSpans.forEach(s => {
    const tStart = s.token_start;
    const tEnd = s.token_end;
    if (tStart >= 0 && tStart < tokens.length && tEnd >= 0 && tEnd < tokens.length) {
      const cStart = tokens[tStart].start;
      const cEnd = tokens[tEnd].end;
      let entText = '';
      if (fullText && cEnd <= fullText.length) {
        entText = fullText.slice(cStart, cEnd);
      } else {
        entText = tokens.slice(tStart, tEnd + 1).map(t => t.text).join(' ');
      }
      enriched.push({
        start: cStart,
        end: cEnd,
        token_start: tStart,
        token_end: tEnd,
        label: s.label,
        text: entText
      });
    }
  });

  return { spans: enriched, strTags: strTags };
}

// Reconstruct bracket text e.g. [Entity]LABEL from clean text and spans
function spansToBracketText(cleanText, spans) {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let result = '';
  let lastIdx = 0;
  sorted.forEach(s => {
    result += cleanText.slice(lastIdx, s.start);
    const entText = s.text || cleanText.slice(s.start, s.end);
    result += `[${entText}]${s.label}`;
    lastIdx = s.end;
  });
  result += cleanText.slice(lastIdx);
  return result;
}

// Core Universal Record Parser
function parseRecord(line, options = {}, defaultIndex = 0) {
  const lineStr = line.trim();
  if (!lineStr) return null;

  // Skip CSV header line if present
  if (lineStr.replace(/["']/g, '').trim() === 'id,tokens,ner_tags') {
    return null;
  }

  let data = null;
  let isCsvFormat = false;

  // 1. Check if CSV row: e.g. "0","['Pupunan', 'nin']","[0, 0, 5]"
  if (lineStr.startsWith('"') && lineStr.includes('","')) {
    const cols = parseCsvLine(lineStr);
    if (cols.length >= 3) {
      const recId = cols[0].replace(/^"|"$/g, '');
      const tokensList = parseListString(cols[1]);
      const nerTagsList = parseListString(cols[2]);
      data = {
        id: recId,
        tokens: tokensList,
        ner_tags: nerTagsList
      };
      isCsvFormat = true;
    }
  }

  // 2. Check if JSON line
  if (!data) {
    if (lineStr.startsWith('{') && lineStr.endsWith('}')) {
      try {
        data = JSON.parse(lineStr);
      } catch (e) {
        data = { text: lineStr };
      }
    } else {
      data = { text: lineStr };
    }
  }

  // Format Detection
  const hasNerTags = Array.isArray(data.ner_tags);
  const hasTokensArray = Array.isArray(data.tokens);
  const isProdigyObj = hasTokensArray && data.tokens.length > 0 && typeof data.tokens[0] === 'object' && Array.isArray(data.spans);
  const isBioFormat = isCsvFormat || (hasNerTags && (hasTokensArray || Array.isArray(data.spans) || typeof data.text === 'string'));

  let detectedFormat = 'bracket';
  if (isCsvFormat) detectedFormat = 'bio_csv';
  else if (isBioFormat) detectedFormat = 'bio';
  else if (isProdigyObj) detectedFormat = 'prodigy';
  else detectedFormat = 'bracket';

  const docId = data.document_id || '';
  const orderVal = typeof data.order === 'number' ? data.order : defaultIndex;
  const recId = data.id !== undefined ? String(data.id) : String(defaultIndex);

  let cleanText = '';
  let bracketText = '';
  let tokens = [];
  let spans = [];
  let nerTagsInt = [];
  let nerTagsStr = [];

  if (detectedFormat === 'bio' || detectedFormat === 'bio_csv') {
    // Process BIO Format (CSV or JSON)
    const rawTokens = data.tokens || [];
    const inputNerTags = data.ner_tags || [];
    let text = data.text || '';

    let tokenTexts = [];
    if (rawTokens.length > 0 && typeof rawTokens[0] === 'string') {
      tokenTexts = rawTokens;
    } else if (rawTokens.length > 0 && typeof rawTokens[0] === 'object') {
      tokenTexts = rawTokens.map(t => t.text || '');
    }

    if (!text && tokenTexts.length > 0) {
      text = tokenTexts.join(' ');
    }
    cleanText = text;

    tokens = alignTokenStringsToText(tokenTexts, cleanText);

    const converted = bioTagsToSpans(tokens, inputNerTags, cleanText);
    spans = converted.spans;
    nerTagsStr = converted.strTags;

    // Auto-discover active labels
    nerTagsStr.forEach(tag => {
      if (tag.startsWith('B-') || tag.startsWith('I-')) {
        const lbl = tag.slice(2);
        if (lbl && !state.activeLabels.includes(lbl)) {
          state.activeLabels.push(lbl);
          renderLabelChips();
        }
      }
    });

    // Build Integer Tag List
    nerTagsInt = nerTagsStr.map(t => getTagId(t));

    bracketText = spansToBracketText(cleanText, spans);

  } else if (detectedFormat === 'prodigy') {
    // Process Prodigy JSONL
    cleanText = data.text || '';
    tokens = data.tokens || [];
    const inputSpans = data.spans || [];

    spans = inputSpans.map(s => ({
      start: s.start !== undefined ? s.start : 0,
      end: s.end !== undefined ? s.end : 0,
      token_start: s.token_start !== undefined ? s.token_start : 0,
      token_end: s.token_end !== undefined ? s.token_end : 0,
      label: s.label || 'ENTITY',
      text: cleanText.slice(s.start, s.end)
    }));

    spans.forEach(s => {
      if (s.label && !state.activeLabels.includes(s.label)) {
        state.activeLabels.push(s.label);
        renderLabelChips();
      }
    });

    nerTagsStr = [];
    nerTagsInt = [];
    tokens.forEach(t => {
      const tId = t.id !== undefined ? t.id : 0;
      const matched = spans.find(s => s.token_start <= tId && tId <= s.token_end);
      if (!matched) {
        nerTagsStr.push('O');
        nerTagsInt.push(0);
      } else if (tId === matched.token_start) {
        const tag = `B-${matched.label}`;
        nerTagsStr.push(tag);
        nerTagsInt.push(getTagId(tag));
      } else {
        const tag = `I-${matched.label}`;
        nerTagsStr.push(tag);
        nerTagsInt.push(getTagId(tag));
      }
    });

    bracketText = spansToBracketText(cleanText, spans);

  } else {
    // Process Bracket-Annotated Format
    const rawText = data.text || '';
    if (!rawText) return null;

    const labels = options.labels && options.labels.length > 0 ? options.labels : state.activeLabels;
    const safeLabels = labels.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const bracketPattern = new RegExp(`\\[(.*?)\\](${safeLabels}|[A-Za-z0-9_]+)`, 'g');

    cleanText = '';
    const extractedSpans = [];
    let currentIdx = 0;
    let match;

    while ((match = bracketPattern.exec(rawText)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      const entityText = match[1];
      const label = match[2];

      if (!state.activeLabels.includes(label)) {
        state.activeLabels.push(label);
        renderLabelChips();
      }

      cleanText += rawText.slice(currentIdx, start);
      const spanStart = cleanText.length;
      cleanText += entityText;
      const spanEnd = cleanText.length;

      extractedSpans.push({
        start: spanStart,
        end: spanEnd,
        label: label,
        text: entityText
      });
      currentIdx = end;
    }
    cleanText += rawText.slice(currentIdx);

    tokens = tokenizeCleanText(cleanText);

    spans = [];
    extractedSpans.forEach(s => {
      let tStart = null;
      let tEnd = null;
      for (const t of tokens) {
        if (t.start === s.start || (t.start > s.start && tStart === null)) {
          tStart = t.id;
        }
        if (t.end === s.end || (t.end > s.end && tEnd === null)) {
          tEnd = t.id;
        }
      }
      if (tStart !== null && tEnd !== null) {
        spans.push({
          start: s.start,
          end: s.end,
          token_start: tStart,
          token_end: tEnd,
          label: s.label,
          text: s.text
        });
      }
    });

    nerTagsStr = [];
    nerTagsInt = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const matched = spans.find(s => s.token_start <= t.id && t.id <= s.token_end);
      if (!matched) {
        nerTagsStr.push('O');
        nerTagsInt.push(0);
      } else if (t.id === matched.token_start) {
        const tag = `B-${matched.label}`;
        nerTagsStr.push(tag);
        nerTagsInt.push(getTagId(tag));
      } else {
        const tag = `I-${matched.label}`;
        nerTagsStr.push(tag);
        nerTagsInt.push(getTagId(tag));
      }
    }

    bracketText = rawText;
  }

  // Tokens with attached BIO tags
  const tokensWithBio = tokens.map((t, idx) => ({
    ...t,
    bioTag: nerTagsStr[idx] || 'O',
    bioTagId: nerTagsInt[idx] !== undefined ? nerTagsInt[idx] : 0
  }));

  const tokenTexts = tokens.map(t => t.text);

  // 1. Build Standard BIO Format Entry with Integer Tags
  const bioEntryInt = {
    id: recId,
    tokens: tokenTexts,
    ner_tags: nerTagsInt
  };
  if (docId) bioEntryInt.document_id = docId;
  if (orderVal !== undefined) bioEntryInt.order = orderVal;

  // 2. Build BIO Format Entry with String Tags
  const bioEntryStr = {
    id: recId,
    tokens: tokenTexts,
    ner_tags: nerTagsStr
  };
  if (docId) bioEntryStr.document_id = docId;
  if (orderVal !== undefined) bioEntryStr.order = orderVal;

  // 3. Build CSV Row String: "id","tokens","ner_tags"
  const csvTokensStr = "[" + tokenTexts.map(t => `'${t.replace(/'/g, "\\'")}'`).join(',') + "]";
  const csvTagsStr = "[" + nerTagsInt.join(',') + "]";
  const csvRow = `"${recId}","${csvTokensStr}","${csvTagsStr}"`;

  // 4. Build Standard Prodigy Entry
  const signed = options.useSignedHash !== undefined ? options.useSignedHash : state.useSignedHash;
  const defaultTimestamp = getFormattedTimestamp(options.timestampFormat || state.timestampFormat);
  const annotator = options.annotatorId || state.annotatorId || defaultTimestamp;
  const session = options.sessionId || state.sessionId || defaultTimestamp;

  const prodigyEntry = {
    text: cleanText,
    document_id: docId,
    order: orderVal,
    _input_hash: hashString32(cleanText, signed),
    _task_hash: hashString32(bracketText, signed),
    _is_binary: false,
    tokens: tokens,
    _view_id: 'ner_manual',
    spans: spans.map(s => ({
      start: s.start,
      end: s.end,
      token_start: s.token_start,
      token_end: s.token_end,
      label: s.label
    })),
    answer: 'accept',
    _timestamp: Math.floor(Date.now() / 1000),
    _annotator_id: annotator,
    _session_id: session
  };

  // 5. Build Standard Bracket Annotated Entry
  const bracketEntry = {
    text: bracketText
  };
  if (docId) bracketEntry.document_id = docId;
  if (orderVal !== undefined) bracketEntry.order = orderVal;

  return {
    sourceFormat: detectedFormat,
    id: recId,
    cleanText: cleanText,
    bracketText: bracketText,
    bio: bioEntryInt,
    bioStr: bioEntryStr,
    csvRow: csvRow,
    prodigy: prodigyEntry,
    bracket: bracketEntry,
    spans: spans,
    tokens: tokens,
    tokenTexts: tokenTexts,
    tokensWithBio: tokensWithBio,
    nerTagsInt: nerTagsInt,
    nerTagsStr: nerTagsStr
  };
}

// DOM Elements
const inputEditor = document.getElementById('inputEditor');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const labelsContainer = document.getElementById('labelsContainer');
const newTagInput = document.getElementById('newTagInput');
const addTagBtn = document.getElementById('addTagBtn');
const annotatorInput = document.getElementById('annotatorInput');
const sessionInput = document.getElementById('sessionInput');
const hashSignSelect = document.getElementById('hashSignSelect');
const timestampStyleSelect = document.getElementById('timestampStyleSelect');
const schemaFormatSelect = document.getElementById('schemaFormatSelect');
const outputFormatSelect = document.getElementById('outputFormatSelect');
const saveBtn = document.getElementById('saveBtn');
const downloadBtnLabel = document.getElementById('downloadBtnLabel');
const detectedFormatBadge = document.getElementById('detectedFormatBadge');

// Modal Elements
const editModal = document.getElementById('editModal');
const modalTitle = document.getElementById('modalTitle');
const modalSubtitle = document.getElementById('modalSubtitle');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalTextInput = document.getElementById('modalTextInput');
const modalDocIdInput = document.getElementById('modalDocIdInput');
const modalOrderInput = document.getElementById('modalOrderInput');
const modalIdInput = document.getElementById('modalIdInput');
const modalTagButtons = document.getElementById('modalTagButtons');
const modalLivePreviewContent = document.getElementById('modalLivePreviewContent');
const modalSpanCountBadge = document.getElementById('modalSpanCountBadge');
const modalBioSequenceContent = document.getElementById('modalBioSequenceContent');
const modalTokenCountBadge = document.getElementById('modalTokenCountBadge');

// Stats Counters
const statRecordCount = document.getElementById('statRecordCount');
const statEntityCount = document.getElementById('statEntityCount');
const statTokenCount = document.getElementById('statTokenCount');

let currentEditRecordIndex = null;
let currentEditLineIndex = null;

// Notification Toast
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Session State Persistence
function saveSessionState(showFeedback = false) {
  try {
    const activeTabEl = document.querySelector('.tab-btn.active');
    const activeTabId = activeTabEl ? activeTabEl.getAttribute('data-tab') : 'visualTab';
    
    const sessionData = {
      inputText: inputEditor ? inputEditor.value : '',
      activeLabels: state.activeLabels,
      annotatorId: annotatorInput ? annotatorInput.value : '',
      sessionId: sessionInput ? sessionInput.value : '',
      useSignedHash: hashSignSelect ? hashSignSelect.value === 'signed' : true,
      timestampFormat: timestampStyleSelect ? timestampStyleSelect.value : 'datetime',
      schemaFormat: schemaFormatSelect ? schemaFormatSelect.value : state.schemaFormat,
      outputFormat: outputFormatSelect ? outputFormatSelect.value : 'compact',
      activeTab: activeTabId,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));

    if (showFeedback) {
      showToast('Session saved! Your work will continue where you left off next time.');
    }
  } catch (err) {
    console.error('Failed to save session state:', err);
    if (showFeedback) {
      showToast('Failed to save session state', 'error');
    }
  }
}

function loadSessionState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;

    const data = JSON.parse(saved);
    if (!data) return false;

    if (Array.isArray(data.activeLabels) && data.activeLabels.length > 0) {
      state.activeLabels = data.activeLabels;
      renderLabelChips();
    }
    if (annotatorInput && data.annotatorId !== undefined) {
      annotatorInput.value = data.annotatorId;
    }
    if (sessionInput && data.sessionId !== undefined) {
      sessionInput.value = data.sessionId;
    }
    if (hashSignSelect && data.useSignedHash !== undefined) {
      hashSignSelect.value = data.useSignedHash ? 'signed' : 'unsigned';
      state.useSignedHash = data.useSignedHash;
    }
    if (timestampStyleSelect && data.timestampFormat) {
      timestampStyleSelect.value = data.timestampFormat;
      state.timestampFormat = data.timestampFormat;
    }
    if (schemaFormatSelect && data.schemaFormat) {
      schemaFormatSelect.value = data.schemaFormat;
      state.schemaFormat = data.schemaFormat;
      updateDownloadLabel();
    }
    if (outputFormatSelect && data.outputFormat) {
      outputFormatSelect.value = data.outputFormat;
      state.outputFormat = data.outputFormat;
    }
    if (inputEditor && typeof data.inputText === 'string') {
      inputEditor.value = data.inputText;
    }
    if (data.activeTab) {
      const tabBtn = document.querySelector(`.tab-btn[data-tab="${data.activeTab}"]`);
      if (tabBtn) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tabBtn.classList.add('active');
        const targetContent = document.getElementById(data.activeTab);
        if (targetContent) targetContent.classList.add('active');
      }
    }

    processInput();
    return true;
  } catch (err) {
    console.error('Failed to load session state:', err);
    return false;
  }
}

function updateDownloadLabel() {
  const schema = schemaFormatSelect ? schemaFormatSelect.value : state.schemaFormat;
  if (downloadBtnLabel) {
    if (schema === 'bio_csv') {
      downloadBtnLabel.textContent = 'Export BIO CSV';
    } else if (schema === 'bio' || schema === 'bio_str') {
      downloadBtnLabel.textContent = 'Export BIO JSONL';
    } else if (schema === 'prodigy') {
      downloadBtnLabel.textContent = 'Export Prodigy JSONL';
    } else {
      downloadBtnLabel.textContent = 'Export Bracket JSONL';
    }
  }
}

// Render Active Labels in Toolbar
function renderLabelChips() {
  if (!labelsContainer) return;
  labelsContainer.innerHTML = '';
  state.activeLabels.forEach(label => {
    const chip = document.createElement('span');
    const isStandard = ['PER', 'LOC', 'ORG', 'DATE'].includes(label);
    const bId = getTagId(`B-${label}`);
    const iId = getTagId(`I-${label}`);
    chip.className = `label-chip label-${isStandard ? label : 'custom'}`;
    chip.title = `B-${label}: ${bId} | I-${label}: ${iId}`;
    chip.innerHTML = `
      <span>${label} (${bId},${iId})</span>
      <span class="label-chip-remove" title="Remove ${label}">&times;</span>
    `;
    chip.querySelector('.label-chip-remove').addEventListener('click', () => {
      removeLabel(label);
    });
    labelsContainer.appendChild(chip);
  });
}

function addLabel(tag) {
  const cleanTag = tag.trim().toUpperCase();
  if (!cleanTag) return;
  if (!state.activeLabels.includes(cleanTag)) {
    state.activeLabels.push(cleanTag);
    renderLabelChips();
    processInput();
    saveSessionState(false);
    showToast(`Added label [${cleanTag}]`);
  }
}

function removeLabel(tag) {
  if (state.activeLabels.length <= 1) {
    showToast('At least one label must be active', 'error');
    return;
  }
  state.activeLabels = state.activeLabels.filter(l => l !== tag);
  renderLabelChips();
  processInput();
  saveSessionState(false);
}

// In-place Format Conversion
function convertInputTo(targetFormat) {
  if (state.records.length === 0) {
    showToast('No records to convert', 'error');
    return;
  }

  let convertedText = '';
  if (targetFormat === 'bio_csv') {
    convertedText = '"id","tokens","ner_tags"\n' + state.records.map(r => r.csvRow).join('\n');
  } else if (targetFormat === 'bio') {
    convertedText = state.records.map(r => JSON.stringify(r.bio)).join('\n');
  } else if (targetFormat === 'bracket') {
    convertedText = state.records.map(r => JSON.stringify(r.bracket)).join('\n');
  } else if (targetFormat === 'prodigy') {
    convertedText = state.records.map(r => JSON.stringify(r.prodigy)).join('\n');
  }

  if (inputEditor) {
    inputEditor.value = convertedText;
    processInput();
    saveSessionState(false);
    showToast(`Converted input to ${targetFormat.toUpperCase()}!`);
  }
}

// Processing Execution
let debounceTimer;
function processInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const rawContent = inputEditor ? inputEditor.value : '';
    const lines = rawContent.split(/\r?\n/);
    const results = [];

    const signed = hashSignSelect ? hashSignSelect.value === 'signed' : state.useSignedHash;
    const tsFormat = timestampStyleSelect ? timestampStyleSelect.value : state.timestampFormat;
    const schema = schemaFormatSelect ? schemaFormatSelect.value : state.schemaFormat;
    state.useSignedHash = signed;
    state.timestampFormat = tsFormat;
    state.schemaFormat = schema;

    const formatCounts = { bio_csv: 0, bio: 0, prodigy: 0, bracket: 0 };
    let recordIndex = 0;

    lines.forEach((line, lineIdx) => {
      const parsed = parseRecord(line, {
        labels: state.activeLabels,
        annotatorId: annotatorInput ? annotatorInput.value.trim() : '',
        sessionId: sessionInput ? sessionInput.value.trim() : '',
        useSignedHash: signed,
        timestampFormat: tsFormat
      }, recordIndex);

      if (parsed) {
        parsed.lineIndex = lineIdx;
        results.push(parsed);
        if (parsed.sourceFormat in formatCounts) {
          formatCounts[parsed.sourceFormat]++;
        }
        recordIndex++;
      }
    });

    state.records = results;

    // Update Detected Format Badge
    if (detectedFormatBadge) {
      if (results.length === 0) {
        detectedFormatBadge.textContent = 'Auto-Detecting Format';
        detectedFormatBadge.className = 'format-detect-badge';
      } else {
        const topFormat = Object.keys(formatCounts).reduce((a, b) => formatCounts[a] >= formatCounts[b] ? a : b);
        const formatNames = { 
          bio_csv: 'BIO CSV ("id","tokens","ner_tags")', 
          bio: 'BIO Format JSON', 
          prodigy: 'Prodigy NER JSONL', 
          bracket: 'Bracket Text' 
        };
        detectedFormatBadge.textContent = `Detected: ${formatNames[topFormat] || topFormat}`;
        detectedFormatBadge.className = `format-detect-badge format-${topFormat === 'bio_csv' ? 'bio' : topFormat}`;
      }
    }

    updateUI();
    saveSessionState(false);
  }, 70);
}

// UI Updating
function updateUI() {
  updateStats();
  renderVisualPreview();
  renderTokensView();
  renderJsonView();
}

function updateStats() {
  const totalRecords = state.records.length;
  let totalEntities = 0;
  let totalTokens = 0;
  const labelBreakdown = {};
  let totalB = 0;
  let totalI = 0;
  let totalO = 0;

  state.records.forEach(r => {
    totalEntities += r.spans.length;
    totalTokens += r.tokens.length;
    r.spans.forEach(s => {
      labelBreakdown[s.label] = (labelBreakdown[s.label] || 0) + 1;
    });
    if (r.nerTagsStr) {
      r.nerTagsStr.forEach(tag => {
        if (tag.startsWith('B-')) totalB++;
        else if (tag.startsWith('I-')) totalI++;
        else totalO++;
      });
    }
  });

  if (statRecordCount) statRecordCount.textContent = totalRecords;
  if (statEntityCount) statEntityCount.textContent = totalEntities;
  if (statTokenCount) statTokenCount.textContent = totalTokens;

  // Breakdown in stats tab
  const statsDetail = document.getElementById('statsDetailContainer');
  if (statsDetail) {
    let breakdownHtml = `
      <div class="stats-grid">
        <div class="stat-box">
          <span class="stat-title">Total Records</span>
          <span class="stat-value">${totalRecords}</span>
        </div>
        <div class="stat-box">
          <span class="stat-title">Total Entities</span>
          <span class="stat-value">${totalEntities}</span>
        </div>
        <div class="stat-box">
          <span class="stat-title">Total Tokens</span>
          <span class="stat-value">${totalTokens}</span>
        </div>
        <div class="stat-box">
          <span class="stat-title">Avg Tokens / Record</span>
          <span class="stat-value">${totalRecords ? (totalTokens / totalRecords).toFixed(1) : 0}</span>
        </div>
      </div>

      <div style="margin-top: 1.25rem;">
        <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Tag ID Mapping Reference (CoNLL / BicolaNER)</h4>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <span class="label-chip" style="background: rgba(148,163,184,0.15); color: var(--text-muted);"><strong>O</strong>: 0</span>
          <span class="label-chip label-PER"><strong>B-PER</strong>: 1</span>
          <span class="label-chip label-PER"><strong>I-PER</strong>: 2</span>
          <span class="label-chip label-ORG"><strong>B-ORG</strong>: 3</span>
          <span class="label-chip label-ORG"><strong>I-ORG</strong>: 4</span>
          <span class="label-chip label-LOC"><strong>B-LOC</strong>: 5</span>
          <span class="label-chip label-LOC"><strong>I-LOC</strong>: 6</span>
          <span class="label-chip label-DATE"><strong>B-DATE</strong>: 7</span>
          <span class="label-chip label-DATE"><strong>I-DATE</strong>: 8</span>
        </div>
      </div>

      <div style="margin-top: 1.25rem;">
        <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">BIO Tag Statistics</h4>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <div class="stat-box" style="padding: 0.6rem 0.9rem; flex: 1; min-width: 120px;">
            <span class="stat-title">B- (Begin) Tags</span>
            <span class="stat-value" style="color: #c7d2fe; font-size: 1.15rem;">${totalB}</span>
          </div>
          <div class="stat-box" style="padding: 0.6rem 0.9rem; flex: 1; min-width: 120px;">
            <span class="stat-title">I- (Inside) Tags</span>
            <span class="stat-value" style="color: #a5f3fc; font-size: 1.15rem;">${totalI}</span>
          </div>
          <div class="stat-box" style="padding: 0.6rem 0.9rem; flex: 1; min-width: 120px;">
            <span class="stat-title">O (Outside) Tokens</span>
            <span class="stat-value" style="color: var(--text-muted); font-size: 1.15rem;">${totalO}</span>
          </div>
        </div>
      </div>

      <div style="margin-top: 1.25rem;">
        <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Entity Distribution</h4>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
    `;

    for (const [lbl, count] of Object.entries(labelBreakdown)) {
      const isStd = ['PER', 'LOC', 'ORG', 'DATE'].includes(lbl);
      breakdownHtml += `
        <div class="label-chip label-${isStd ? lbl : 'custom'}" style="font-size: 0.85rem; padding: 0.4rem 0.8rem;">
          <strong>${lbl}</strong>: ${count}
        </div>
      `;
    }

    if (Object.keys(labelBreakdown).length === 0) {
      breakdownHtml += `<div style="color: var(--text-muted); font-size: 0.85rem;">No entities found. Check your bracket formatting or BIO ner_tags.</div>`;
    }

    breakdownHtml += `</div></div>`;
    statsDetail.innerHTML = breakdownHtml;
  }
}

// Render Visual Preview
function renderVisualPreview() {
  const container = document.getElementById('visualPreviewContainer');
  if (!container) return;

  if (state.records.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <p>No valid records to display.</p>
        <p style="font-size: 0.8rem; margin-top: 0.4rem;">Paste BIO CSV ("id","tokens","ner_tags"), BIO JSON, or bracket annotations above.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  state.records.forEach((record, idx) => {
    const card = document.createElement('div');
    card.className = 'visual-entry-card';
    card.title = 'Click to open and edit annotation';

    const cleanText = record.cleanText;
    const spans = record.spans;

    let highlightedHtml = '';
    let cur = 0;
    const sortedSpans = [...spans].sort((a, b) => a.start - b.start);

    sortedSpans.forEach(s => {
      highlightedHtml += escapeHtml(cleanText.slice(cur, s.start));
      const entityStr = escapeHtml(s.text || cleanText.slice(s.start, s.end));
      const isStd = ['PER', 'LOC', 'ORG', 'DATE'].includes(s.label);
      const pillClass = isStd ? `entity-pill-${s.label}` : 'entity-pill-custom';

      highlightedHtml += `
        <span class="entity-pill ${pillClass}" title="Label: ${s.label} | Span: [${s.start}:${s.end}] | Tokens: [${s.token_start}..${s.token_end}]">
          <span>${entityStr}</span>
          <span class="entity-pill-tag">${s.label}</span>
        </span>
      `;
      cur = s.end;
    });
    highlightedHtml += escapeHtml(cleanText.slice(cur));

    // Summary tags
    const labelCounts = {};
    spans.forEach(s => { labelCounts[s.label] = (labelCounts[s.label] || 0) + 1; });
    const tagBadges = Object.entries(labelCounts).map(([lbl, c]) => {
      const isStd = ['PER', 'LOC', 'ORG', 'DATE'].includes(lbl);
      return `<span class="label-chip label-${isStd ? lbl : 'custom'}" style="font-size: 0.68rem; padding: 0.1rem 0.4rem;">${lbl} (${c})</span>`;
    }).join(' ');

    const formatLabel = record.sourceFormat === 'bio_csv' ? 'BIO CSV' : (record.sourceFormat === 'bio' ? 'BIO JSON' : (record.sourceFormat === 'prodigy' ? 'Prodigy' : 'Bracket'));

    card.innerHTML = `
      <div class="entry-header">
        <div class="entry-header-left">
          <span style="font-family: var(--font-mono); font-weight: 700;">#${idx + 1} (id: "${escapeHtml(record.id)}")</span>
          <span class="format-detect-badge format-${record.sourceFormat === 'bio_csv' ? 'bio' : record.sourceFormat}" style="font-size: 0.62rem; padding: 0.05rem 0.35rem;">${formatLabel}</span>
          <span class="entry-edit-badge" title="Click to edit">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>Edit</span>
          </span>
        </div>
        <div class="entry-tags-summary">${tagBadges}</div>
      </div>
      <div class="annotated-text-box">${highlightedHtml}</div>
    `;

    card.addEventListener('click', () => {
      openEditModal(idx);
    });

    container.appendChild(card);
  });
}

// Modal Dialog Logic
function renderModalTagButtons() {
  if (!modalTagButtons) return;
  modalTagButtons.innerHTML = '';
  state.activeLabels.forEach(label => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isStd = ['PER', 'LOC', 'ORG', 'DATE'].includes(label);
    const bId = getTagId(`B-${label}`);
    btn.className = `modal-tag-chip-btn tag-${isStd ? label : 'custom'}`;
    btn.innerHTML = `+ [${label}] <span style="opacity:0.7;font-size:0.68rem;">(#${bId})</span>`;
    btn.title = `Wrap selected text with [selection]${label} (ID: ${bId})`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      wrapSelectionInModalTag(label);
    });
    modalTagButtons.appendChild(btn);
  });
}

function openEditModal(recordIdx) {
  const record = state.records[recordIdx];
  if (!record) return;

  currentEditRecordIndex = recordIdx;
  currentEditLineIndex = record.lineIndex !== undefined ? record.lineIndex : recordIdx;

  if (modalTitle) modalTitle.textContent = `Edit Annotation & BIO Tags`;
  if (modalSubtitle) {
    modalSubtitle.textContent = `Record #${recordIdx + 1} • id: "${record.id}"`;
  }

  if (modalTextInput) {
    modalTextInput.value = record.bracketText || '';
  }
  if (modalDocIdInput) {
    modalDocIdInput.value = record.bracket.document_id || '';
  }
  if (modalOrderInput) {
    modalOrderInput.value = record.bracket.order !== undefined && record.bracket.order !== null ? record.bracket.order : recordIdx;
  }
  if (modalIdInput) {
    modalIdInput.value = record.id || String(recordIdx);
  }

  renderModalTagButtons();
  updateModalLivePreview();

  if (editModal) {
    editModal.classList.add('active');
    editModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      modalTextInput?.focus();
    }, 60);
  }
}

function closeEditModal() {
  if (editModal) {
    editModal.classList.remove('active');
    editModal.setAttribute('aria-hidden', 'true');
  }
  currentEditRecordIndex = null;
  currentEditLineIndex = null;
}

function updateModalLivePreview() {
  if (!modalLivePreviewContent || !modalTextInput) return;
  const rawText = modalTextInput.value;
  if (!rawText.trim()) {
    modalLivePreviewContent.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Type bracket text or select tags above...</span>';
    if (modalSpanCountBadge) modalSpanCountBadge.textContent = '0 entities';
    if (modalBioSequenceContent) modalBioSequenceContent.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem;">No tokens</span>';
    if (modalTokenCountBadge) modalTokenCountBadge.textContent = '0 tokens';
    return;
  }

  const labels = state.activeLabels.length > 0 ? state.activeLabels : ['PER', 'LOC', 'ORG', 'DATE'];
  const safeLabels = labels.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const bracketPattern = new RegExp(`\\[(.*?)\\](${safeLabels}|[A-Za-z0-9_]+)`, 'g');

  let cleanText = '';
  const spans = [];
  let cur = 0;
  let match;

  while ((match = bracketPattern.exec(rawText)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    const entityText = match[1];
    const label = match[2];

    cleanText += rawText.slice(cur, start);
    const spanStart = cleanText.length;
    cleanText += entityText;
    const spanEnd = cleanText.length;

    spans.push({
      start: spanStart,
      end: spanEnd,
      label: label,
      text: entityText
    });
    cur = end;
  }
  cleanText += rawText.slice(cur);

  // Render Highlighted Preview
  let highlightedHtml = '';
  let curHighlight = 0;
  spans.forEach(s => {
    highlightedHtml += escapeHtml(cleanText.slice(curHighlight, s.start));
    const isStd = ['PER', 'LOC', 'ORG', 'DATE'].includes(s.label);
    const pillClass = isStd ? `entity-pill-${s.label}` : 'entity-pill-custom';
    highlightedHtml += `
      <span class="entity-pill ${pillClass}">
        <span>${escapeHtml(s.text)}</span>
        <span class="entity-pill-tag">${s.label}</span>
      </span>
    `;
    curHighlight = s.end;
  });
  highlightedHtml += escapeHtml(cleanText.slice(curHighlight));
  modalLivePreviewContent.innerHTML = highlightedHtml;

  if (modalSpanCountBadge) {
    modalSpanCountBadge.textContent = `${spans.length} entit${spans.length === 1 ? 'y' : 'ies'}`;
  }

  // Tokenize and build live BIO sequence tokens
  const tokens = tokenizeCleanText(cleanText);
  const finalSpans = [];
  spans.forEach(s => {
    let tStart = null;
    let tEnd = null;
    for (const t of tokens) {
      if (t.start === s.start || (t.start > s.start && tStart === null)) {
        tStart = t.id;
      }
      if (t.end === s.end || (t.end > s.end && tEnd === null)) {
        tEnd = t.id;
      }
    }
    if (tStart !== null && tEnd !== null) {
      finalSpans.push({ ...s, token_start: tStart, token_end: tEnd });
    }
  });

  const nerTags = [];
  const nerTagIds = [];
  tokens.forEach(t => {
    const matched = finalSpans.find(s => s.token_start <= t.id && t.id <= s.token_end);
    if (!matched) {
      nerTags.push('O');
      nerTagIds.push(0);
    } else if (t.id === matched.token_start) {
      const tag = `B-${matched.label}`;
      nerTags.push(tag);
      nerTagIds.push(getTagId(tag));
    } else {
      const tag = `I-${matched.label}`;
      nerTags.push(tag);
      nerTagIds.push(getTagId(tag));
    }
  });

  // Render Modal Live BIO Token Sequence
  if (modalBioSequenceContent) {
    let bioSeqHtml = '';
    tokens.forEach((t, i) => {
      const tag = nerTags[i] || 'O';
      const tagId = nerTagIds[i] !== undefined ? nerTagIds[i] : 0;
      let tagClass = 'tag-o-pill';
      if (tag.startsWith('B-')) tagClass = 'tag-b-pill';
      else if (tag.startsWith('I-')) tagClass = 'tag-i-pill';

      bioSeqHtml += `
        <div class="modal-bio-token-item" title="Token #${t.id}: ${escapeHtml(t.text)} | Tag: ${tag} (ID: ${tagId})">
          <span class="modal-bio-token-word">${escapeHtml(t.text)}</span>
          <span class="modal-bio-token-tag ${tagClass}">${escapeHtml(tag)} <strong style="opacity:0.85;">(${tagId})</strong></span>
        </div>
      `;
    });
    modalBioSequenceContent.innerHTML = bioSeqHtml || '<span style="color: var(--text-muted);">No tokens</span>';
  }

  if (modalTokenCountBadge) {
    modalTokenCountBadge.textContent = `${tokens.length} tokens`;
  }
}

function wrapSelectionInModalTag(label) {
  if (!modalTextInput) return;
  const start = modalTextInput.selectionStart;
  const end = modalTextInput.selectionEnd;
  const text = modalTextInput.value;

  let replacement = '';
  let newCursorStart = start;
  let newCursorEnd = end;

  if (start !== end) {
    const selected = text.slice(start, end);
    replacement = `[${selected}]${label}`;
    modalTextInput.value = text.slice(0, start) + replacement + text.slice(end);
    newCursorStart = start;
    newCursorEnd = start + replacement.length;
  } else {
    replacement = `[Entity]${label}`;
    modalTextInput.value = text.slice(0, start) + replacement + text.slice(end);
    newCursorStart = start + 1;
    newCursorEnd = start + 7;
  }

  modalTextInput.focus();
  modalTextInput.setSelectionRange(newCursorStart, newCursorEnd);
  updateModalLivePreview();
}

function saveModalChanges() {
  if (currentEditRecordIndex === null || !modalTextInput) return;

  const newBracketText = modalTextInput.value.trim();
  const newDocId = modalDocIdInput ? modalDocIdInput.value.trim() : '';
  const newOrderStr = modalOrderInput ? modalOrderInput.value.trim() : '';
  const newId = modalIdInput ? modalIdInput.value.trim() : String(currentEditRecordIndex);

  const lines = inputEditor.value.split(/\r?\n/);
  const lineIdx = currentEditLineIndex;

  if (lineIdx < 0 || lineIdx >= lines.length) {
    showToast('Error locating record line', 'error');
    return;
  }

  const originalRecord = state.records[currentEditRecordIndex];
  const sourceFmt = originalRecord ? originalRecord.sourceFormat : 'bio_csv';

  const tempParsed = parseRecord(newBracketText, { labels: state.activeLabels }, currentEditRecordIndex);
  if (tempParsed) {
    tempParsed.id = newId;
    tempParsed.bio.id = newId;
    tempParsed.bioStr.id = newId;
    if (newDocId) {
      tempParsed.bracket.document_id = newDocId;
      tempParsed.prodigy.document_id = newDocId;
    }
    if (newOrderStr !== '') {
      const orderNum = Number(newOrderStr);
      tempParsed.bracket.order = orderNum;
      tempParsed.prodigy.order = orderNum;
    }
  }

  let updatedLine = '';
  if (sourceFmt === 'bio_csv' && tempParsed) {
    const csvTokensStr = "[" + tempParsed.tokenTexts.map(t => `'${t.replace(/'/g, "\\'")}'`).join(',') + "]";
    const csvTagsStr = "[" + tempParsed.nerTagsInt.join(',') + "]";
    updatedLine = `"${newId}","${csvTokensStr}","${csvTagsStr}"`;
  } else if (sourceFmt === 'bio' && tempParsed) {
    updatedLine = JSON.stringify(tempParsed.bio);
  } else if (sourceFmt === 'prodigy' && tempParsed) {
    updatedLine = JSON.stringify(tempParsed.prodigy);
  } else {
    if (newDocId || newOrderStr !== '') {
      const bObj = { text: newBracketText };
      if (newDocId) bObj.document_id = newDocId;
      if (newOrderStr !== '') bObj.order = Number(newOrderStr);
      updatedLine = JSON.stringify(bObj);
    } else {
      updatedLine = newBracketText;
    }
  }

  lines[lineIdx] = updatedLine;
  inputEditor.value = lines.join('\n');

  processInput();
  saveSessionState(false);

  const updatedNum = currentEditRecordIndex + 1;
  closeEditModal();
  showToast(`Record #${updatedNum} (id: "${newId}") updated successfully!`);
}

// Render Token Matrix Table with BIO Tag Badges
function renderTokensView() {
  const container = document.getElementById('tokensContainer');
  if (!container) return;

  if (state.records.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No tokens generated yet.</div>`;
    return;
  }

  let html = '';

  state.records.forEach((record, recIdx) => {
    html += `
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary);">
            Record #${recIdx + 1} (${record.tokens.length} tokens) • id: "${escapeHtml(record.id)}"
          </h4>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="format-detect-badge format-${record.sourceFormat === 'bio_csv' ? 'bio' : record.sourceFormat}" style="font-size: 0.65rem;">
              ${record.sourceFormat.toUpperCase()}
            </span>
          </div>
        </div>
        <div class="token-table-container">
          <table class="token-table">
            <thead>
              <tr>
                <th style="width: 40px;">ID</th>
                <th>Token</th>
                <th style="width: 140px;">BIO Tag & ID</th>
                <th style="width: 100px;">Char Offset</th>
                <th style="width: 85px;">Whitespace</th>
                <th>Entity Span</th>
              </tr>
            </thead>
            <tbody>
    `;

    record.tokensWithBio.forEach((t) => {
      const matchedSpan = record.spans.find(
        s => t.id >= s.token_start && t.id <= s.token_end
      );

      let entityBadge = '-';
      if (matchedSpan) {
        const isStd = ['PER', 'LOC', 'ORG', 'DATE'].includes(matchedSpan.label);
        entityBadge = `<span class="label-chip label-${isStd ? matchedSpan.label : 'custom'}" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">${matchedSpan.label} [tok ${matchedSpan.token_start}..${matchedSpan.token_end}]</span>`;
      }

      const bioTag = t.bioTag || 'O';
      const tagId = t.bioTagId !== undefined ? t.bioTagId : 0;
      let bioClass = 'bio-badge-o';
      if (bioTag.startsWith('B-')) bioClass = 'bio-badge-b';
      else if (bioTag.startsWith('I-')) bioClass = 'bio-badge-i';

      html += `
        <tr>
          <td style="color: var(--text-muted);">${t.id}</td>
          <td class="token-text-cell">${escapeHtml(t.text)}</td>
          <td>
            <span class="bio-badge ${bioClass}">
              ${escapeHtml(bioTag)} <span style="opacity: 0.8; font-size: 0.72rem;">(ID: ${tagId})</span>
            </span>
          </td>
          <td>[${t.start}..${t.end}]</td>
          <td><span class="${t.ws ? 'ws-true' : 'ws-false'}">${t.ws ? 'ws: true' : 'ws: false'}</span></td>
          <td>${entityBadge}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Generate Dataset Output String
function getExportOutputString(format = state.outputFormat, schema = state.schemaFormat) {
  if (state.records.length === 0) return '';

  if (schema === 'bio_csv') {
    const rows = ['"id","tokens","ner_tags"'];
    state.records.forEach(r => rows.push(r.csvRow));
    return rows.join('\n');
  } else if (schema === 'bio') {
    const targetDataset = state.records.map(r => r.bio);
    return format === 'pretty' ? JSON.stringify(targetDataset, null, 2) : targetDataset.map(item => JSON.stringify(item)).join('\n');
  } else if (schema === 'bio_str') {
    const targetDataset = state.records.map(r => r.bioStr);
    return format === 'pretty' ? JSON.stringify(targetDataset, null, 2) : targetDataset.map(item => JSON.stringify(item)).join('\n');
  } else if (schema === 'prodigy') {
    const targetDataset = state.records.map(r => r.prodigy);
    return format === 'pretty' ? JSON.stringify(targetDataset, null, 2) : targetDataset.map(item => JSON.stringify(item)).join('\n');
  } else if (schema === 'bracket') {
    const targetDataset = state.records.map(r => r.bracket);
    return format === 'pretty' ? JSON.stringify(targetDataset, null, 2) : targetDataset.map(item => JSON.stringify(item)).join('\n');
  } else {
    const rows = ['"id","tokens","ner_tags"'];
    state.records.forEach(r => rows.push(r.csvRow));
    return rows.join('\n');
  }
}

// Render JSON / Dataset Output View
function renderJsonView() {
  const jsonPre = document.getElementById('jsonOutputPre');
  const recordCountBadge = document.getElementById('jsonRecordBadge');
  const lineBadge = document.getElementById('jsonLineBadge');
  if (!jsonPre) return;

  if (state.records.length === 0) {
    jsonPre.textContent = '// Output dataset will appear here';
    if (recordCountBadge) recordCountBadge.textContent = '0 records';
    if (lineBadge) lineBadge.textContent = '0 lines';
    return;
  }

  const format = outputFormatSelect ? outputFormatSelect.value : state.outputFormat;
  const schema = schemaFormatSelect ? schemaFormatSelect.value : state.schemaFormat;
  state.outputFormat = format;
  state.schemaFormat = schema;
  updateDownloadLabel();

  const outputStr = getExportOutputString(format, schema);
  jsonPre.textContent = outputStr;
  
  const lineCount = outputStr.split('\n').length;
  if (recordCountBadge) recordCountBadge.textContent = `${state.records.length} record(s)`;
  if (lineBadge) {
    lineBadge.textContent = `${lineCount} line${lineCount === 1 ? '' : 's'}`;
  }
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Clipboard Copy
function copyJsonlOutput() {
  if (state.records.length === 0) {
    showToast('No output to copy', 'error');
    return;
  }
  const format = outputFormatSelect ? outputFormatSelect.value : state.outputFormat;
  const schema = schemaFormatSelect ? schemaFormatSelect.value : state.schemaFormat;
  const outputStr = getExportOutputString(format, schema);
  const schemaTitle = schema === 'bio_csv' ? 'BIO CSV' : (schema === 'bio' ? 'BIO JSON (Int Tags)' : (schema === 'bio_str' ? 'BIO JSON (String Tags)' : 'Dataset'));

  navigator.clipboard.writeText(outputStr).then(() => {
    showToast(`Copied ${state.records.length} record(s) to clipboard (${schemaTitle})!`);
  }).catch(() => {
    showToast('Failed to copy to clipboard', 'error');
  });
}

// Download Dataset
function downloadJsonlOutput() {
  if (state.records.length === 0) {
    showToast('No records to export', 'error');
    return;
  }
  const format = outputFormatSelect ? outputFormatSelect.value : state.outputFormat;
  const schema = schemaFormatSelect ? schemaFormatSelect.value : state.schemaFormat;
  
  let filename = 'bio_dataset.csv';
  let mimeType = 'text/csv;charset=utf-8';

  if (schema === 'bio_csv') {
    filename = 'bio_dataset.csv';
    mimeType = 'text/csv;charset=utf-8';
  } else if (schema === 'bio' || schema === 'bio_str') {
    filename = 'bio_format.jsonl';
    mimeType = 'application/x-jsonlines;charset=utf-8';
  } else if (schema === 'prodigy') {
    filename = 'prodigy_format.jsonl';
    mimeType = 'application/x-jsonlines;charset=utf-8';
  } else {
    filename = 'bracket_dataset.jsonl';
    mimeType = 'application/x-jsonlines;charset=utf-8';
  }
  
  const outputStr = getExportOutputString(format, schema);
  const blob = new Blob([outputStr], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${filename} successfully!`);
}

// Download Python Script
function downloadPythonScript() {
  const pythonScriptUrl = 'bracket_parser.py';
  const a = document.createElement('a');
  a.href = pythonScriptUrl;
  a.download = 'bracket_parser.py';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Downloaded bracket_parser.py');
}

// Tab Switching
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
      saveSessionState(false);
    });
  });
}

// File Drag & Drop
function setupFileDrop() {
  if (!dropzone || !fileInput) return;
  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    if (inputEditor) inputEditor.value = e.target.result;
    processInput();
    saveSessionState(false);
    showToast(`Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  };
  reader.readAsText(file);
}

// Sample Loader
function loadSample(key) {
  if (SAMPLE_DATASETS[key]) {
    if (inputEditor) inputEditor.value = SAMPLE_DATASETS[key];
    processInput();
    saveSessionState(false);
    showToast(`Loaded ${key} sample dataset`);
  }
}

// Event Listeners Initialization
function init() {
  renderLabelChips();
  setupTabs();
  setupFileDrop();

  // Modal Listeners
  modalTextInput?.addEventListener('input', updateModalLivePreview);
  modalCloseBtn?.addEventListener('click', closeEditModal);
  modalCancelBtn?.addEventListener('click', closeEditModal);
  modalSaveBtn?.addEventListener('click', saveModalChanges);
  
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        closeEditModal();
      }
    });
  }

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (editModal && editModal.classList.contains('active')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeEditModal();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveModalChanges();
      }
    }
  });

  // Input listeners
  inputEditor?.addEventListener('input', processInput);
  annotatorInput?.addEventListener('input', processInput);
  sessionInput?.addEventListener('input', processInput);
  hashSignSelect?.addEventListener('change', processInput);
  timestampStyleSelect?.addEventListener('change', processInput);
  
  schemaFormatSelect?.addEventListener('change', () => {
    state.schemaFormat = schemaFormatSelect.value;
    updateDownloadLabel();
    renderJsonView();
    saveSessionState(false);
  });

  outputFormatSelect?.addEventListener('change', () => {
    state.outputFormat = outputFormatSelect.value;
    renderJsonView();
    saveSessionState(false);
  });
  
  const wrapCodeToggle = document.getElementById('wrapCodeToggle');
  if (wrapCodeToggle) {
    wrapCodeToggle.addEventListener('change', (e) => {
      const jsonPre = document.getElementById('jsonOutputPre');
      if (jsonPre) {
        if (e.target.checked) {
          jsonPre.classList.add('wrapped');
        } else {
          jsonPre.classList.remove('wrapped');
        }
      }
    });
  }

  // Add tag
  addTagBtn?.addEventListener('click', () => {
    addLabel(newTagInput.value);
    newTagInput.value = '';
  });

  newTagInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLabel(newTagInput.value);
      newTagInput.value = '';
    }
  });

  // Preset Buttons
  document.getElementById('sampleKasanggayahanBtn')?.addEventListener('click', () => loadSample('kasanggayahan'));
  document.getElementById('sampleBioBtn')?.addEventListener('click', () => loadSample('bio'));
  document.getElementById('sampleBicol5Btn')?.addEventListener('click', () => loadSample('bicoldot5'));
  document.getElementById('sampleBicol159Btn')?.addEventListener('click', () => loadSample('bicol159'));
  document.getElementById('sampleProdigyBtn')?.addEventListener('click', () => loadSample('prodigy'));
  document.getElementById('sampleMultiBtn')?.addEventListener('click', () => loadSample('multilingual'));
  document.getElementById('sampleRawBtn')?.addEventListener('click', () => loadSample('rawText'));
  document.getElementById('clearBtn')?.addEventListener('click', () => {
    if (inputEditor) inputEditor.value = '';
    processInput();
    saveSessionState(false);
    showToast('Cleared input editor');
  });

  // Convert In-Place Buttons
  document.getElementById('convertInputBioCsvBtn')?.addEventListener('click', () => convertInputTo('bio_csv'));
  document.getElementById('convertInputBioBtn')?.addEventListener('click', () => convertInputTo('bio'));
  document.getElementById('convertInputBracketBtn')?.addEventListener('click', () => convertInputTo('bracket'));
  document.getElementById('convertInputProdigyBtn')?.addEventListener('click', () => convertInputTo('prodigy'));

  // Action Buttons
  saveBtn?.addEventListener('click', () => saveSessionState(true));
  document.getElementById('copyBtn')?.addEventListener('click', copyJsonlOutput);
  document.getElementById('downloadBtn')?.addEventListener('click', downloadJsonlOutput);
  document.getElementById('downloadPyBtn')?.addEventListener('click', downloadPythonScript);

  // Restore saved session if available, otherwise load Kasanggayahan BIO sample
  const restored = loadSessionState();
  if (!restored) {
    loadSample('kasanggayahan');
  }
}

// Start app once DOM is ready
document.addEventListener('DOMContentLoaded', init);
