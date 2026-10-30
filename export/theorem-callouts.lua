-- theorem-callouts.lua — pandoc filter for Obsidian notes written for the Theorem Callouts plugin.
--
--   > [!lemma] title          -> \begin{lemma}[{title}] ... \end{lemma}, one counter for all types
--   > [!lemma|1.11]           -> fixed number «Лемма 1.11», counter not advanced
--   > [!definition|*]         -> unnumbered «Определение»
--   > [!thm], [!lem], ...     -> short names, as Math Booster accepts them
--   other callouts ([!question], [!note], ...) -> unnumbered, caption = title or type word
--   ^label after a callout    -> \label{label}
--   $$...$$ ^eq-label         -> equation environment with \label
--   [[#^label]]               -> \ref{label};  [[Note#^label]] -> number read from that note
--   [[Note]], [[Note|text]]   -> plain text;   ![[image.png|300]] -> image
--   `\begin{proof}` / `\end{proof}` -> amsthm proof
--   `\begin{proof}[Proof of [[#^thm]]]` -> the same with its own caption
--   numbersections: true      -> numbered sections; [[#Heading]] -> \ref, [[Note#Heading]] -> its number,
--                                «??» for a heading the note lacks; also thcl-numbersections
--   thcl-unnumbered: [Heading] -> \section*;  thcl-appendix: Heading -> appendices «Приложение A» from it on
--   thcl-title-heading: true  -> the heading that opens the note becomes the title
--   The language (ru/en) comes from `lang:` or the prose.
--   Notes of other files are looked up in the vault: the nearest folder above the input file
--   that contains `.obsidian`, or $OBSIDIAN_VAULT. The plugin's settings (first heading as the title,
--   unnumbered headings) are read from the vault's .obsidian/plugins/theorem-callouts/data.json.

local THEOREM_TYPES = {
  theorem = "plain", lemma = "plain", proposition = "plain", corollary = "plain",
  claim = "plain", conjecture = "plain", hypothesis = "plain",
  definition = "definition", example = "definition", exercise = "definition",
  axiom = "definition", assumption = "definition",
  remark = "remark",
}
local ALIASES = {
  axm = "axiom", def = "definition", lem = "lemma", prp = "proposition", thm = "theorem", cor = "corollary",
  clm = "claim", asm = "assumption", exm = "example", exr = "exercise", cnj = "conjecture", hyp = "hypothesis", rmk = "remark",
}
local ORDER = { "theorem", "lemma", "proposition", "corollary", "claim", "conjecture", "hypothesis",
  "definition", "example", "exercise", "axiom", "assumption", "remark" }
local NAMES = {
  ru = { theorem = "Теорема", lemma = "Лемма", proposition = "Предложение", corollary = "Следствие",
    claim = "Утверждение", conjecture = "Гипотеза", hypothesis = "Гипотеза", definition = "Определение",
    example = "Пример", exercise = "Упражнение", axiom = "Аксиома", assumption = "Предположение",
    remark = "Замечание", question = "Вопрос", note = "Примечание" },
  en = { theorem = "Theorem", lemma = "Lemma", proposition = "Proposition", corollary = "Corollary",
    claim = "Claim", conjecture = "Conjecture", hypothesis = "Hypothesis", definition = "Definition",
    example = "Example", exercise = "Exercise", axiom = "Axiom", assumption = "Assumption",
    remark = "Remark", question = "Question", note = "Note" },
}
local READER = "commonmark_x+hard_line_breaks-superscript-subscript"

local function find_vault()
  local env = os.getenv("OBSIDIAN_VAULT")
  if env and env ~= "" then return env end
  local input = PANDOC_STATE.input_files[1]
  if not input or input == "-" then return pandoc.system.get_working_directory() end
  local dir = pandoc.path.directory(pandoc.path.normalize(pandoc.path.join({ pandoc.system.get_working_directory(), input })))
  while true do
    local ok, entries = pcall(pandoc.system.list_directory, dir)
    if ok then for _, e in ipairs(entries) do if e == ".obsidian" then return dir end end end
    local up = pandoc.path.directory(dir)
    if up == dir then return pandoc.system.get_working_directory() end
    dir = up
  end
end
local VAULT = find_vault()

-- The plugin's settings, so that the PDF numbers sections as the plugin does.
local function load_settings()
  local s = { titleHeading = false, unnumbered = "References, Bibliography, Литература, Список литературы" }
  local f = io.open(VAULT .. "/.obsidian/plugins/theorem-callouts/data.json", "r")
  if f then
    local ok, d = pcall(pandoc.json.decode, f:read("a"), false)
    f:close()
    if ok and type(d) == "table" then for k, v in pairs(d) do s[k] = v end end
  end
  local list = {}
  for name in tostring(s.unnumbered):gmatch("[^,]+") do
    name = name:gsub("^%s+", ""):gsub("%s+$", "")
    if name ~= "" then list[#list + 1] = name end
  end
  return { titleHeading = s.titleHeading == true, unnumbered = list }
end
local SETTINGS = load_settings()

local lang = "en"

-- ---------- helpers ----------

local function latex(inlines)
  local s = pandoc.write(pandoc.Pandoc({ pandoc.Plain(inlines) }), "latex")
  return (s:gsub("%s+$", ""))
end

local function callout_header(block)
  -- Returns tag, meta, title inlines, rest of the first paragraph; or nil.
  if block.t ~= "BlockQuote" or #block.content == 0 or block.content[1].t ~= "Para" then return nil end
  local para = block.content[1]
  local first = para.content[1]
  if not first or first.t ~= "Str" then return nil end
  local tag, meta, fold = first.text:match("^%[!([%a]+)|?([^%]]*)%]([+-]?)$")
  if not tag then return nil end
  local rest = pandoc.List()
  for i = 2, #para.content do rest:insert(para.content[i]) end
  while #rest > 0 and rest[1].t == "Space" do rest:remove(1) end
  local title = pandoc.List()
  while #rest > 0 do
    local x = rest:remove(1)
    if x.t == "SoftBreak" or x.t == "LineBreak" then break end
    title:insert(x)
  end
  tag = tag:lower()
  return ALIASES[tag] or tag, meta, title, rest
end

local function label_of(block)
  if block and block.t == "Para" and #block.content == 1 and block.content[1].t == "Str" then
    return block.content[1].text:match("^%^([%w_-]+)$")
  end
end

-- A label written right after a callout, without a blank line, ends the callout's last paragraph.
-- Returns it, and removes it from the callout when `remove` is set.
local function trailing_label(quote, remove)
  local last = quote.content[#quote.content]
  if not last or last.t ~= "Para" then return nil end
  local n = #last.content
  local s, prev = last.content[n], last.content[n - 1]
  local lab = s and s.t == "Str" and s.text:match("^%^([%w_-]+)$")
  if not lab or not prev or not (prev.t == "LineBreak" or prev.t == "SoftBreak") then return nil end
  if remove then last.content:remove(n); last.content:remove(n - 1) end
  return lab
end

local function detect_lang(doc)
  local meta_lang = doc.meta.lang and pandoc.utils.stringify(doc.meta.lang) or ""
  if meta_lang:match("^ru") then return "ru" end
  if meta_lang:match("^en") then return "en" end
  local parts = {}
  doc:walk({ Str = function(s) parts[#parts + 1] = s.text end })
  local text = table.concat(parts, " ")
  local _, cyr = text:gsub("[\208\209][\128-\191]", "")
  local _, lat = text:gsub("[A-Za-z]", "")
  return (cyr > 0 and cyr >= lat) and "ru" or "en"
end

-- Numbers of labelled statements and equations in a parsed document, as the plugin shows them.
local function number_labels(blocks)
  local numbers, counter, eq = {}, 0, 0
  local function visit(list)
    for i, b in ipairs(list) do
      local tag, meta = callout_header(b)
      if tag and THEOREM_TYPES[tag] then
        local n
        if meta == "" then counter = counter + 1; n = tostring(counter)
        elseif meta ~= "*" then n = meta end
        local lab = label_of(list[i + 1]) or trailing_label(b, false)
        if lab and n then numbers[lab] = n end
      end
      if b.t == "BlockQuote" then visit(b.content) end
      if b.t == "Para" then
        for k, x in ipairs(b.content) do
          if x.t == "Math" and x.mathtype == "DisplayMath" then
            local nxt = b.content[k + 1]
            if nxt and (nxt.t == "Space" or nxt.t == "SoftBreak" or nxt.t == "LineBreak") then nxt = b.content[k + 2] end
            local lab = nxt and nxt.t == "Str" and nxt.text:match("^%^([%w_-]+)$")
            local star, tag = x.text:match("\\tag(%*?)(%b{})")
            if lab and tag then numbers[lab] = star == "*" and tag:sub(2, -2) or "(" .. tag:sub(2, -2) .. ")"
            elseif lab then eq = eq + 1; numbers[lab] = "(" .. eq .. ")" end
          end
        end
      end
    end
  end
  visit(blocks)
  return numbers
end

-- Links compare heading text without regard to case and runs of spaces.
-- ASCII punctuation does not count, as in the plugin: Obsidian finds a heading without its brackets.
local function heading_key(inlines)
  local s = pandoc.text.lower(pandoc.utils.stringify(inlines)):gsub("%p", " "):gsub("%s+", " "):gsub("^ ", ""):gsub(" $", "")
  return s
end

-- Strings of a metadata value: a scalar or a list.
local function meta_strings(v)
  if v == nil then return {} end
  if pandoc.utils.type(v) == "List" then
    local out = {}
    for _, x in ipairs(v) do out[#out + 1] = pandoc.utils.stringify(x) end
    return out
  end
  return { pandoc.utils.stringify(v) }
end

local function numbered(doc)
  return doc.meta.numbersections == true or doc.meta["thcl-numbersections"] == true
end

-- `thcl-title-heading` in the note, otherwise the plugin's setting.
local function title_heading(doc)
  local v = doc.meta["thcl-title-heading"]
  if type(v) == "boolean" then return v end
  return SETTINGS.titleHeading
end

-- Section numbers as the plugin shows them: with `numbersections: true`, three levels deep, the top level
-- present being the section; with `thcl-title-heading` the heading that opens the note is its title.
-- Headings in the setting or in `thcl-unnumbered` stay without a number, with everything under them;
-- from the `thcl-appendix` heading on, sections are lettered A, B and their subsections A.1.
-- Returns heading key -> number, the set of unnumbered keys, and the key of the first appendix heading.
local function number_headings(doc)
  if not numbered(doc) then return {}, {}, nil end
  local list = {}
  for _, b in ipairs(doc.blocks) do if b.t == "Header" then list[#list + 1] = b end end
  if list[1] and doc.blocks[1] == list[1] and title_heading(doc) then table.remove(list, 1) end
  local listed = {}
  for _, h in ipairs(SETTINGS.unnumbered) do listed[heading_key(pandoc.Inlines(h))] = true end
  for _, h in ipairs(meta_strings(doc.meta["thcl-unnumbered"])) do listed[heading_key(pandoc.Inlines(h))] = true end
  local app = doc.meta["thcl-appendix"]
  local appendix = app and heading_key(pandoc.Inlines(pandoc.utils.stringify(app)))
  local top = math.huge
  for _, h in ipairs(list) do top = math.min(top, h.level) end
  local out, skipped, counters = {}, {}, { 0, 0, 0 }
  local in_appendix, first_appendix, skip_below = false, nil, nil
  for _, h in ipairs(list) do
    local key = heading_key(h.content)
    if skip_below and h.level > skip_below then skipped[key] = true
    else
      skip_below = nil
      local depth = h.level - top + 1
      if listed[key] then skipped[key] = true; skip_below = h.level
      else
        if depth == 1 and key == appendix and not in_appendix then
          in_appendix, first_appendix, counters = true, key, { 0, 0, 0 }
        end
        if depth <= 3 then
          counters[depth] = counters[depth] + 1
          for k = depth + 1, 3 do counters[k] = 0 end
          local parts = { table.unpack(counters, 1, depth) }
          if in_appendix then parts[1] = string.char(64 + counters[1]) end
          out[key] = table.concat(parts, ".")
        end
      end
    end
  end
  return out, skipped, first_appendix
end

-- macOS returns file names in NFD (й = и + U+0306, ё = е + U+0308); links in the text are NFC.
local function nfc(s)
  return (s:gsub("и\204\134", "й"):gsub("И\204\134", "Й"):gsub("е\204\136", "ё"):gsub("Е\204\136", "Ё"))
end

local note_index, note_cache = nil, {}
local function find_note(name)
  if not note_index then
    note_index = {}
    local function walk(dir)
      local ok, entries = pcall(pandoc.system.list_directory, dir)
      if not ok then return end
      for _, e in ipairs(entries) do
        if e:sub(1, 1) ~= "." then
          local p = dir .. "/" .. e
          if e:match("%.md$") then local k = nfc(e:sub(1, -4)); note_index[k] = note_index[k] or p
          elseif not e:match("%.%w+$") then walk(p) end
        end
      end
    end
    walk(VAULT)
  end
  local base = name:match("([^/]+)$") or name
  return note_index[nfc(base)]
end

local function external_number(note, label)
  if not note_cache[note] then
    local path = find_note(note)
    local numbers = {}
    if path then
      local f = io.open(path, "r")
      if f then
        local text = f:read("a"); f:close()
        local doc = pandoc.read(text, READER)
        numbers = number_labels(doc.blocks)
        for key, n in pairs((number_headings(doc))) do numbers["#" .. key] = n end
        numbers["#"] = numbered(doc) or nil
      end
    end
    note_cache[note] = numbers
  end
  return note_cache[note][label]
end

-- ---------- inline: wiki links, embeds, proofs ----------

local local_labels, local_sections, local_numbered = {}, {}, false

local function wikilink(content)
  local target, alias = content:match("^([^|]*)|(.*)$")
  target = target or content
  local note, label = target:match("^(.-)#%^([%w_-]+)$")
  local hnote, heading = target:match("^([^#]*)#.-([^#]+)$")
  if heading and not label and not alias then
    local key = heading_key(pandoc.Inlines(heading))
    -- A heading that a note with numbered sections lacks prints «??», as the plugin shows it.
    if hnote == "" then
      local id = local_sections[key]
      return id and pandoc.RawInline("latex", "\\ref{" .. id .. "}") or pandoc.Str(local_numbered and "??" or heading)
    end
    return pandoc.Str(external_number(hnote, "#" .. key) or (external_number(hnote, "#") and "??") or heading)
  end
  if label and not alias then
    if note == "" then
      local shown = local_labels[label]
      -- Equations are referred to with parentheses, as the plugin shows them: \eqref.
      if shown then return pandoc.RawInline("latex", (shown:match("^%(") and "\\eqref{" or "\\ref{") .. label .. "}") end
      return pandoc.Str("??")
    end
    return pandoc.Str(external_number(note, label) or "??")
  end
  if alias then return pandoc.Str(alias) end
  local shown = target:gsub("#%^?.*$", ""):match("([^/]+)$") or target
  return pandoc.Str(shown)
end

local file_index = nil
local function find_file(name)
  if not file_index then
    file_index = {}
    local function walk(dir)
      local ok, entries = pcall(pandoc.system.list_directory, dir)
      if not ok then return end
      for _, e in ipairs(entries) do
        if e:sub(1, 1) ~= "." then
          local p = dir .. "/" .. e
          if e:match("%.%w+$") then local k = nfc(e); file_index[k] = file_index[k] or p else walk(p) end
        end
      end
    end
    walk(VAULT)
  end
  return file_index[nfc(name:match("([^/]+)$") or name)]
end

local tmpdir = nil
local function embed(content)
  local src, size = content:match("^([^|]*)|(.*)$")
  src = src or content
  local path = find_file(src) or src
  -- LaTeX cannot read webp; convert with macOS sips.
  if path:lower():match("%.webp$") then
    tmpdir = tmpdir or pandoc.system.get_working_directory()
    local png = os.tmpname() .. ".png"
    local ok = pcall(pandoc.pipe, "sips", { "-s", "format", "png", path, "--out", png }, "")
    if ok then path = png end
  end
  local attr = {}
  local w = size and size:match("^(%d+)")
  if w then attr = pandoc.Attr("", {}, { width = w .. "px" }) end
  return pandoc.Image({}, path, "", attr)
end

-- MathJax accepts X^\mathbb N, LaTeX with unicode-math needs X^{\mathbb N}.
local function brace_scripts(t)
  t = t:gsub("([_^])%s*(\\[%a]+%s*%b{})", function(op, arg)
    if arg:match("^\\math") or arg:match("^\\operatorname") or arg:match("^\\text") then return op .. "{" .. arg .. "}" end
  end)
  t = t:gsub("([_^])%s*(\\math%a+)%s*(%w)", "%1{%2 %3}")
  return t
end

local function process_inlines(inlines)
  for _, x in ipairs(inlines) do
    if x.t == "Math" then x.text = brace_scripts(x.text) end
  end
  -- Join runs of inlines between "[[" and "]]" (link targets may contain spaces).
  local out, i = pandoc.List(), 1
  while i <= #inlines do
    local x = inlines[i]
    if x.t == "Str" and x.text:find("%[%[") then
      local buf, j = "", i
      while j <= #inlines do
        local y = inlines[j]
        if y.t == "Str" then buf = buf .. y.text
        elseif y.t == "Space" or y.t == "SoftBreak" then buf = buf .. " "
        -- A heading link may contain math: [[#Levels $K_1$]].
        elseif y.t == "Math" and y.mathtype == "InlineMath" and j > i then buf = buf .. "$" .. y.text .. "$"
        else break end
        if buf:find("%]%]") and select(2, buf:gsub("%[%[", "")) <= select(2, buf:gsub("%]%]", "")) then break end
        j = j + 1
      end
      if j <= #inlines and buf:find("%]%]") then
        local pos = 1
        while true do
          local s, e, bang, content = buf:find("(!?)%[%[(.-)%]%]", pos)
          if not s then break end
          if s > pos then out:insert(pandoc.Str(buf:sub(pos, s - 1))) end
          out:insert(bang == "!" and embed(content) or wikilink(content))
          pos = e + 1
        end
        if pos <= #buf then out:insert(pandoc.Str(buf:sub(pos))) end
        i = j + 1
      else
        out:insert(x); i = i + 1
      end
    elseif x.t == "Code" and (x.text == "\\begin{proof}" or x.text:match("^\\begin{proof}%[.*%]$")) then
      -- Printed as text, not as the proof environment: proofs may close inside a list or a callout.
      local caption = lang == "ru" and "Доказательство." or "Proof."
      local own = x.text:match("^\\begin{proof}%[(.*)%]$")
      if own then
        own = own:gsub("^%s+", ""):gsub("%s+$", "")
        local para = pandoc.read(own, READER).blocks[1]
        caption = latex(process_inlines(para and para.content or pandoc.Inlines({}))) .. (own:match("[.!?:]$") and "" or ".")
      end
      local head = lang == "ru" and "\\textbf{" .. caption .. "}" or "\\textit{" .. caption .. "}"
      out:insert(pandoc.RawInline("latex", head .. "\\enspace "))
      i = i + 1
      if inlines[i] and (inlines[i].t == "LineBreak" or inlines[i].t == "SoftBreak" or inlines[i].t == "Space") then i = i + 1 end
    elseif x.t == "Code" and x.text == "\\end{proof}" then
      if #out > 0 and (out[#out].t == "LineBreak" or out[#out].t == "SoftBreak") then out:remove(#out) end
      out:insert(pandoc.RawInline("latex", "\\nobreak\\hfill\\ensuremath{\\square}"))
      i = i + 1
    elseif x.t == "Math" and x.mathtype == "DisplayMath" then
      local k = i + 1
      -- The label may stand on the next line, as Obsidian allows.
      if inlines[k] and (inlines[k].t == "Space" or inlines[k].t == "SoftBreak" or inlines[k].t == "LineBreak") then k = k + 1 end
      local lab = inlines[k] and inlines[k].t == "Str" and inlines[k].text:match("^%^([%w_-]+)$")
      local multi = x.text:match("\\begin{(%a+)") and x.text:match("\\begin{(align|gather|multline|flalign)")
      if lab and not multi then
        out:insert(pandoc.RawInline("latex", "\\begin{equation}" .. x.text .. "\\label{" .. lab .. "}\\end{equation}"))
        i = k + 1
      else
        out:insert(x); i = i + 1
      end
    else
      out:insert(x); i = i + 1
    end
  end
  return out
end

-- ---------- blocks: callouts and labels ----------

local function process_blocks(blocks)
  local out, i = pandoc.List(), 1
  while i <= #blocks do
    local b = blocks[i]
    local lab = label_of(blocks[i + 1])
    local own = not lab and callout_header(b) and trailing_label(b, true)
    local tag, meta, title, rest = callout_header(b)
    if tag then
      local style = THEOREM_TYPES[tag]
      lab = lab or own
      local title_tex = #title > 0 and latex(process_inlines(title)) or ""
      local begin, finish
      if style and meta == "" then
        begin = "\\begin{" .. tag .. "}" .. (title_tex ~= "" and "[{" .. title_tex .. "}]" or "")
        if lab then begin = begin .. "\\label{" .. lab .. "}" end
        finish = "\\end{" .. tag .. "}"
      else
        -- Fixed number, unnumbered statement, or a non-theorem callout.
        local word = NAMES[lang][tag] or (tag:sub(1, 1):upper() .. tag:sub(2))
        local name, opt
        if style and meta ~= "*" then name = word .. " " .. meta; opt = title_tex
        elseif style then name = word; opt = title_tex
        else name = title_tex ~= "" and title_tex or word; opt = "" end
        local env = "tcnamed" .. (style or "remark")
        begin = "\\renewcommand{\\tcname}{" .. name .. "}\\begin{" .. env .. "}" .. (opt ~= "" and "[{" .. opt .. "}]" or "")
        if lab and style and meta ~= "*" then begin = begin .. "\\tcsetlabel{" .. meta .. "}\\label{" .. lab .. "}" end
        finish = "\\end{" .. env .. "}"
      end
      local body = pandoc.List()
      if #rest > 0 then body:insert(pandoc.Para(rest)) end
      for k = 2, #b.content do body:insert(b.content[k]) end
      out:insert(pandoc.RawBlock("latex", begin))
      out:extend(body)
      out:insert(pandoc.RawBlock("latex", finish))
      i = i + 1
      if lab and not own then i = i + 1 end
    else
      out:insert(b); i = i + 1
    end
  end
  return out
end

local function theorem_header()
  local t = {}
  local function add(style)
    table.insert(t, "\\theoremstyle{" .. style .. "}")
    for _, k in ipairs(ORDER) do
      if THEOREM_TYPES[k] == style then
        if k == "theorem" then table.insert(t, "\\newtheorem{theorem}{" .. NAMES[lang].theorem .. "}")
        else table.insert(t, "\\newtheorem{" .. k .. "}[theorem]{" .. NAMES[lang][k] .. "}") end
      end
    end
    table.insert(t, "\\newtheorem*{tcnamed" .. style .. "}{\\tcname}")
  end
  table.insert(t, "\\newcommand{\\tcname}{}")
  add("plain"); add("definition"); add("remark")
  table.insert(t, "\\makeatletter\\newcommand{\\tcsetlabel}[1]{\\def\\@currentlabel{#1}}\\makeatother")
  return pandoc.RawBlock("latex", table.concat(t, "\n"))
end

function Pandoc(doc)
  lang = detect_lang(doc)
  doc.meta.lang = pandoc.MetaString(lang)

  local sections, skipped, appendix = number_headings(doc)
  local_numbered = numbered(doc)
  if local_numbered then doc.meta.numbersections = true end

  -- With `thcl-title-heading` (or the setting) the heading that opens the note becomes the title.
  if not doc.meta.title and doc.blocks[1] and doc.blocks[1].t == "Header" and title_heading(doc) then
    doc.meta.title = pandoc.MetaInlines(doc.blocks[1].content)
    doc.blocks:remove(1)
  end

  -- Sections: the top level present becomes \section, three levels are numbered, as in the plugin.
  local top = math.huge
  for _, b in ipairs(doc.blocks) do if b.t == "Header" then top = math.min(top, b.level) end end
  for _, b in ipairs(doc.blocks) do if b.t == "Header" then b.level = b.level - top + 1 end end
  if next(sections) or next(skipped) then
    local blocks = pandoc.List()
    for _, b in ipairs(doc.blocks) do
      if b.t == "Header" then
        local key = heading_key(b.content)
        -- Pandoc's own identifiers are escaped in LaTeX labels when they are not ASCII.
        if sections[key] then
          b.identifier = "sec-" .. sections[key]
          local_sections[key] = local_sections[key] or b.identifier
        end
        if skipped[key] then
          b.classes:insert("unnumbered")
          -- An unnumbered section after the appendix, such as the references, is not part of it.
          if appendix == "open" and b.level == 1 then blocks:insert(pandoc.RawBlock("latex", "\\end{appendices}")); appendix = "closed" end
        end
        -- The appendix package prints «Приложение A» before the title and in the contents.
        if key == appendix and b.level == 1 then blocks:insert(pandoc.RawBlock("latex", "\\begin{appendices}")); appendix = "open" end
      end
      blocks:insert(b)
    end
    if appendix == "open" then blocks:insert(pandoc.RawBlock("latex", "\\end{appendices}")) end
    doc.blocks = blocks
    if not doc.meta.secnumdepth then doc.meta.secnumdepth = pandoc.MetaString("3") end
  end

  -- Labels of numbered statements and equations in this note; links to anything else print "??".
  for lab, shown in pairs(number_labels(doc.blocks)) do local_labels[lab] = shown end

  doc = doc:walk({ Inlines = process_inlines })
  doc = doc:walk({ Blocks = process_blocks })

  -- \newtheorem is allowed in the body; header-includes would be overridden by include-in-header.
  doc.blocks:insert(1, theorem_header())
  return doc
end
