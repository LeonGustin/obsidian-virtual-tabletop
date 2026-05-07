const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, 'raw');
const OUT = __dirname;

function mkdir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function safe(name) { return name.replace(/[/\\?%*:|"<>]/g, '-'); }
function write(folder, name, content) {
  mkdir(folder);
  fs.writeFileSync(path.join(folder, safe(name) + '.md'), content, 'utf8');
}

// Render 5etools entry objects to plain text
function renderEntries(entries, depth = 0) {
  if (!entries) return '';
  const indent = depth > 0 ? '  '.repeat(depth) : '';
  return entries.map(e => {
    if (typeof e === 'string') return indent + e;
    if (e.type === 'entries' || e.type === 'section') {
      const head = e.name ? `\n${indent}**${e.name}**\n` : '';
      return head + renderEntries(e.entries, depth);
    }
    if (e.type === 'list') return renderEntries(e.items, depth + 1).split('\n').map(l => l ? indent + '- ' + l.trim() : '').join('\n');
    if (e.type === 'table') {
      const header = e.colLabels ? '| ' + e.colLabels.join(' | ') + ' |\n| ' + e.colLabels.map(() => '---').join(' | ') + ' |' : '';
      const rows = (e.rows || []).map(r => '| ' + r.map(c => typeof c === 'string' ? c : (c.roll ? c.roll.exact || `${c.roll.min}-${c.roll.max}` : JSON.stringify(c))).join(' | ') + ' |').join('\n');
      return (e.caption ? `\n**${e.caption}**\n` : '') + header + '\n' + rows;
    }
    if (e.type === 'inset' || e.type === 'insetReadaloud') {
      return `\n> **${e.name || 'Inset'}**\n` + renderEntries(e.entries, 0).split('\n').map(l => '> ' + l).join('\n');
    }
    if (e.type === 'quote') return renderEntries(e.entries, 0).split('\n').map(l => '> ' + l).join('\n');
    if (e.entries) return renderEntries(e.entries, depth);
    return '';
  }).filter(Boolean).join('\n\n');
}

function crStr(cr) {
  if (!cr) return '—';
  if (typeof cr === 'string') return cr;
  return cr.cr || '—';
}

function abilityMod(score) {
  return Math.floor((score - 10) / 2);
}
function modStr(score) {
  const m = abilityMod(score);
  return `${score} (${m >= 0 ? '+' : ''}${m})`;
}

// ── MONSTERS ──────────────────────────────────────────────────────────────────
function convertMonsters() {
  const data = JSON.parse(fs.readFileSync(path.join(RAW, 'bestiary-erlw.json'), 'utf8'));
  const fluff = JSON.parse(fs.readFileSync(path.join(RAW, 'fluff-bestiary-erlw.json'), 'utf8'));
  const fluffMap = {};
  (fluff.monsterFluff || []).forEach(f => { fluffMap[f.name] = f; });

  const dir = path.join(OUT, 'Monsters');
  (data.monster || []).forEach(m => {
    const f = fluffMap[m.name] || {};
    const desc = f.entries ? renderEntries(f.entries) : '';
    const ac = Array.isArray(m.ac) ? m.ac.map(a => typeof a === 'object' ? `${a.ac}${a.from ? ' (' + a.from.join(', ') + ')' : ''}` : a).join(', ') : m.ac;
    const hp = m.hp ? `${m.hp.average} (${m.hp.formula})` : '—';
    const speed = m.speed ? Object.entries(m.speed).map(([k, v]) => k === 'walk' ? `${v} ft.` : `${k} ${v} ft.`).join(', ') : '—';
    const saves = m.save ? Object.entries(m.save).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(', ') : '—';
    const skills = m.skill ? Object.entries(m.skill).map(([k, v]) => `${k} ${v}`).join(', ') : '—';
    const senses = [].concat(m.senses || [], m.passive ? [`Passive Perception ${m.passive}`] : []).join(', ') || '—';
    const immune = [].concat(m.immune || [], m.conditionImmune || []).join(', ') || '—';
    const resist = (m.resist || []).join(', ') || '—';
    const langs = (m.languages || []).join(', ') || '—';

    const traits = (m.trait || []).map(t => `**${t.name}.** ${renderEntries(t.entries)}`).join('\n\n');
    const actions = (m.action || []).map(a => `**${a.name}.** ${renderEntries(a.entries)}`).join('\n\n');
    const legendary = (m.legendary || []).map(l => `**${l.name}.** ${renderEntries(l.entries)}`).join('\n\n');
    const reactions = (m.reaction || []).map(r => `**${r.name}.** ${renderEntries(r.entries)}`).join('\n\n');

    const typeStr = typeof m.type === 'object' ? `${m.type.type}${m.type.tags ? ' (' + m.type.tags.join(', ') + ')' : ''}` : (m.type || '—');

    const md = `---
tags: [eberron, monster, "${typeStr}"]
source: ERLW
cr: "${crStr(m.cr)}"
---
# ${m.name}

*${m.size} ${typeStr}, ${Array.isArray(m.alignment) ? m.alignment.join(' ') : (m.alignment || 'unaligned')}*

---

| | |
|---|---|
| **Armor Class** | ${ac} |
| **Hit Points** | ${hp} |
| **Speed** | ${speed} |

| STR | DEX | CON | INT | WIS | CHA |
|---|---|---|---|---|---|
| ${modStr(m.str)} | ${modStr(m.dex)} | ${modStr(m.con)} | ${modStr(m.int)} | ${modStr(m.wis)} | ${modStr(m.cha)} |

| | |
|---|---|
| **Saving Throws** | ${saves} |
| **Skills** | ${skills} |
| **Damage Immunities** | ${immune} |
| **Damage Resistances** | ${resist} |
| **Senses** | ${senses} |
| **Languages** | ${langs} |
| **Challenge** | ${crStr(m.cr)} |

---
${traits ? '## Traits\n\n' + traits + '\n\n' : ''}
## Actions

${actions || '—'}
${reactions ? '\n## Reactions\n\n' + reactions + '\n' : ''}
${legendary ? '\n## Legendary Actions\n\n' + legendary + '\n' : ''}
${desc ? '\n## Description\n\n' + desc : ''}
`;
    write(dir, m.name, md);
  });
  console.log(`Monsters: ${(data.monster||[]).length} notes written`);
}

// ── RACES ─────────────────────────────────────────────────────────────────────
function convertRaces() {
  const data = JSON.parse(fs.readFileSync(path.join(RAW, 'races.json'), 'utf8'));
  const erlw = (data.race || []).filter(r => r.source === 'ERLW');
  const dir = path.join(OUT, 'Races');
  erlw.forEach(r => {
    const abilities = r.ability ? r.ability.map(a => Object.entries(a).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ')).join('; ') : '—';
    const traits = (r.trait || r.entries || []).map(t => {
      if (typeof t === 'string') return t;
      return `**${t.name}.** ${renderEntries(t.entries)}`;
    }).join('\n\n');
    const speed = r.speed ? (typeof r.speed === 'object' ? Object.entries(r.speed).map(([k,v])=> k==='walk'?`${v} ft.`:`${k} ${v} ft.`).join(', ') : `${r.speed} ft.`) : '30 ft.';
    const size = Array.isArray(r.size) ? r.size.join(', ') : (r.size || 'Medium');

    const md = `---
tags: [eberron, race]
source: ERLW
---
# ${r.name}

| | |
|---|---|
| **Size** | ${size} |
| **Speed** | ${speed} |
| **Ability Score Increase** | ${abilities} |
${r.darkvision ? `| **Darkvision** | ${r.darkvision} ft. |\n` : ''}
---

${traits || renderEntries(r.entries)}
`;
    write(dir, r.name, md);
  });
  console.log(`Races: ${erlw.length} notes written`);
}

// ── ITEMS ─────────────────────────────────────────────────────────────────────
function convertItems() {
  const data = JSON.parse(fs.readFileSync(path.join(RAW, 'items.json'), 'utf8'));
  const erlw = (data.item || []).filter(i => i.source === 'ERLW');
  const dir = path.join(OUT, 'Items');
  erlw.forEach(item => {
    const rarity = item.rarity || 'none';
    const entries = renderEntries(item.entries);
    const attune = item.reqAttune ? (typeof item.reqAttune === 'string' ? `Yes (${item.reqAttune})` : 'Yes') : 'No';
    const md = `---
tags: [eberron, item, "${rarity}"]
source: ERLW
rarity: "${rarity}"
requires_attunement: ${item.reqAttune ? 'true' : 'false'}
---
# ${item.name}

*${item.type || 'Item'}, ${rarity}${item.reqAttune ? ', requires attunement' + (typeof item.reqAttune === 'string' ? ' ' + item.reqAttune : '') : ''}*

${entries || '_No description available._'}
`;
    write(dir, item.name, md);
  });
  console.log(`Items: ${erlw.length} notes written`);
}

// ── BACKGROUNDS ───────────────────────────────────────────────────────────────
function convertBackgrounds() {
  const data = JSON.parse(fs.readFileSync(path.join(RAW, 'backgrounds.json'), 'utf8'));
  const erlw = (data.background || []).filter(b => b.source === 'ERLW');
  const dir = path.join(OUT, 'Backgrounds');
  erlw.forEach(bg => {
    const entries = renderEntries(bg.entries);
    const skills = (bg.skillProficiencies || []).map(s => Object.keys(s).join(', ')).join('; ');
    const md = `---
tags: [eberron, background]
source: ERLW
---
# ${bg.name}

**Skill Proficiencies:** ${skills || '—'}

${entries || '_No description available._'}
`;
    write(dir, bg.name, md);
  });
  console.log(`Backgrounds: ${erlw.length} notes written`);
}

// ── FEATS ─────────────────────────────────────────────────────────────────────
function convertFeats() {
  const data = JSON.parse(fs.readFileSync(path.join(RAW, 'feats.json'), 'utf8'));
  const erlw = (data.feat || []).filter(f => f.source === 'ERLW');
  const dir = path.join(OUT, 'Feats');
  erlw.forEach(feat => {
    const entries = renderEntries(feat.entries);
    const prereq = feat.prerequisite ? feat.prerequisite.map(p => Object.values(p).flat().join(', ')).join('; ') : 'None';
    const md = `---
tags: [eberron, feat]
source: ERLW
---
# ${feat.name}

**Prerequisite:** ${prereq}

${entries || '_No description available._'}
`;
    write(dir, feat.name, md);
  });
  console.log(`Feats: ${erlw.length} notes written`);
}

// ── ARTIFICER CLASS ───────────────────────────────────────────────────────────
function convertArtificer() {
  const data = JSON.parse(fs.readFileSync(path.join(RAW, 'class-artificer.json'), 'utf8'));
  const cls = (data.class || []).find(c => c.name === 'Artificer');
  if (!cls) { console.log('Artificer: not found'); return; }
  const dir = path.join(OUT, 'Classes');

  const features = (cls.classFeatures || []).map((f, i) => {
    if (typeof f === 'string') return `- Level ${i+1}: ${f}`;
    return `- Level ${f.level || '?'}: ${f.name || f}`;
  }).join('\n');

  const md = `---
tags: [eberron, class, artificer]
source: ERLW
---
# Artificer

*The Artificer is the signature class of Eberron, first introduced in Eberron: Rising from the Last War.*

## Class Features

${features}

## Subclasses

${(data.subclass || []).map(s => `### ${s.name}\n\n${renderEntries(s.subclassFeatures ? [] : (s.entries || []))}`).join('\n\n')}
`;
  write(dir, 'Artificer', md);
  console.log('Classes: 1 note written (Artificer)');
}

// ── BOOK LORE ─────────────────────────────────────────────────────────────────
function convertBookLore() {
  const data = JSON.parse(fs.readFileSync(path.join(RAW, 'book-erlw.json'), 'utf8'));
  const dir = path.join(OUT, 'Lore');
  let notesWritten = 0;

  (data.data || []).forEach(chapter => {
    const title = chapter.name || 'Chapter';
    const content = renderEntries(chapter.entries);
    if (!content.trim()) return;
    const md = `---
tags: [eberron, lore]
source: ERLW
---
# ${title}

${content}
`;
    write(dir, title, md);
    notesWritten++;
  });
  console.log(`Lore: ${notesWritten} chapter notes written`);
}

// ── RUN ALL ───────────────────────────────────────────────────────────────────
console.log('Converting Eberron content to Obsidian markdown...\n');
try { convertMonsters(); } catch(e) { console.error('Monsters failed:', e.message); }
try { convertRaces(); } catch(e) { console.error('Races failed:', e.message); }
try { convertItems(); } catch(e) { console.error('Items failed:', e.message); }
try { convertBackgrounds(); } catch(e) { console.error('Backgrounds failed:', e.message); }
try { convertFeats(); } catch(e) { console.error('Feats failed:', e.message); }
try { convertArtificer(); } catch(e) { console.error('Artificer failed:', e.message); }
try { convertBookLore(); } catch(e) { console.error('Lore failed:', e.message); }
console.log('\nDone!');
