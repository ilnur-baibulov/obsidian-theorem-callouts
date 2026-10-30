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
--   numbersections: true / false -> numbered sections or not, otherwise the plugin's setting
--   # Heading + ^name below   -> \label{name}; [[#^name]] -> \ref, [[Note#^name]] -> its number
--   # Heading + ^- or ^-name  -> \section*; [[#^name]] -> the heading's text
--   # Heading + ^app-name     -> \appendix before it, with the plugin's Appendix setting on
--   [[#Heading]]              -> the heading's text
--   thm-title-heading: true   -> the heading that opens the note becomes the title
--   thm-numberwithin: true    -> statements and equations numbered within sections, \numberwithin
--   %% comment %%             -> dropped, as Obsidian does not show it
--   The language comes from `lang:`, then the plugin's caption language, then the prose (ru/en).
--   Notes of other files are looked up in the vault: the nearest folder above the input file
--   that contains `.obsidian`, or $OBSIDIAN_VAULT. The plugin's settings (numbered sections,
--   first heading as the title, unnumbered headings) are read from the vault's .obsidian/plugins/theorem-callouts/data.json.

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
    remark = "Замечание", question = "Вопрос", note = "Примечание", proof = "Доказательство" },
  en = { theorem = "Theorem", lemma = "Lemma", proposition = "Proposition", corollary = "Corollary",
    claim = "Claim", conjecture = "Conjecture", hypothesis = "Hypothesis", definition = "Definition",
    example = "Example", exercise = "Exercise", axiom = "Axiom", assumption = "Assumption",
    remark = "Remark", question = "Question", note = "Note", proof = "Proof" },
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
  local s = { language = "auto", numberSections = false, appendix = false, numberWithin = false, refShows = "number", words = {}, types = {}, titleHeading = false, unnumbered = "References, Bibliography, Литература, Список литературы" }
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
  return { language = tostring(s.language), numberSections = s.numberSections == true, appendix = s.appendix == true, numberWithin = s.numberWithin == true,
    refShows = s.refShows, words = type(s.words) == "table" and s.words or {}, types = type(s.types) == "table" and s.types or {},
    titleHeading = s.titleHeading == true, unnumbered = list }
end
local SETTINGS = load_settings()

-- Caption words and types of statements from the settings. A word a language lacks is taken from English,
-- and a type without a word is shown as its name.
for l, words in pairs(SETTINGS.words) do
  NAMES[l] = NAMES[l] or {}
  for k, v in pairs(words) do NAMES[l][k] = v end
end
for t, style in pairs(SETTINGS.types) do
  if not THEOREM_TYPES[t] then THEOREM_TYPES[t] = style; ORDER[#ORDER + 1] = t end
end
setmetatable(NAMES.en, { __index = function(_, k) return k:sub(1, 1):upper() .. k:sub(2) end })
for l, words in pairs(NAMES) do if l ~= "en" then setmetatable(words, { __index = NAMES.en }) end end

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
  local meta_lang = doc.meta.lang and pandoc.utils.stringify(doc.meta.lang):lower() or ""
  for l in pairs(NAMES) do
    if meta_lang == l or meta_lang:sub(1, #l + 1) == l .. "-" then return l end
  end
  if rawget(NAMES, SETTINGS.language) then return SETTINGS.language end
  local parts = {}
  doc:walk({ Str = function(s) parts[#parts + 1] = s.text end })
  local text = table.concat(parts, " ")
  local _, cyr = text:gsub("[\208\209][\128-\191]", "")
  local _, lat = text:gsub("[A-Za-z]", "")
  return (cyr > 0 and cyr >= lat) and "ru" or "en"
end

-- Numbers of labelled statements and equations in a parsed document, as the plugin shows them, and the type
-- and title of each labelled statement. `nums` are the section numbers by block index: with the setting
-- to number within sections, the counters start anew at each numbered top-level section, as \numberwithin does.
local function number_labels(blocks, nums, within)
  local numbers, kinds, counter, eq, section = {}, {}, 0, 0, "0"
  within = within and nums and next(nums) ~= nil
  local function shown(k) return within and section .. "." .. k or tostring(k) end
  local function visit(list, top)
    for i, b in ipairs(list) do
      if top and within and b.t == "Header" and nums[i] and not nums[i]:find("%.") then
        section, counter, eq = nums[i], 0, 0
      end
      local tag, meta, title = callout_header(b)
      if tag and THEOREM_TYPES[tag] then
        local n
        if meta == "" then counter = counter + 1; n = shown(counter)
        elseif meta ~= "*" then n = meta end
        local lab = label_of(list[i + 1]) or trailing_label(b, false)
        if lab and n then numbers[lab] = n; kinds[lab] = { type = tag, title = title } end
      end
      if b.t == "BlockQuote" then visit(b.content, false) end
      if b.t == "Para" then
        for k, x in ipairs(b.content) do
          if x.t == "Math" and x.mathtype == "DisplayMath" then
            local nxt = b.content[k + 1]
            if nxt and (nxt.t == "Space" or nxt.t == "SoftBreak" or nxt.t == "LineBreak") then nxt = b.content[k + 2] end
            local lab = nxt and nxt.t == "Str" and nxt.text:match("^%^([%w_-]+)$")
            local star, tag = x.text:match("\\tag(%*?)(%b{})")
            if lab and tag then numbers[lab] = star == "*" and tag:sub(2, -2) or "(" .. tag:sub(2, -2) .. ")"
            elseif lab then eq = eq + 1; numbers[lab] = "(" .. shown(eq) .. ")" end
          end
        end
      end
    end
  end
  visit(blocks, true)
  return numbers, kinds
end

-- Links compare heading text without regard to case and runs of spaces.
-- ASCII punctuation does not count, as in the plugin: Obsidian finds a heading without its brackets.
local function heading_key(inlines)
  local s = pandoc.text.lower(pandoc.utils.stringify(inlines)):gsub("%p", " "):gsub("%s+", " "):gsub("^ ", ""):gsub(" $", "")
  return s
end

-- `numbersections` in the note, otherwise the plugin's setting.
local function numbered(doc)
  for _, k in ipairs({ "numbersections", "thm-numbersections" }) do
    if type(doc.meta[k]) == "boolean" then return doc.meta[k] end
  end
  return SETTINGS.numberSections
end

-- `thm-numberwithin` in the note, otherwise the plugin's setting.
local function number_within(doc)
  local v = doc.meta["thm-numberwithin"]
  if type(v) == "boolean" then return v end
  return SETTINGS.numberWithin
end

-- `thm-title-heading` in the note, otherwise the plugin's setting.
local function title_heading(doc)
  local v = doc.meta["thm-title-heading"]
  if type(v) == "boolean" then return v end
  return SETTINGS.titleHeading
end

-- Section numbers as the plugin shows them: three levels deep, the top level present being the section.
-- A heading with `^-` below, or listed in the setting and without a label, stays without a number,
-- with everything under it. Returns, by block index, the number and the label of each heading
-- (`^-name` gives the label `name`), the unnumbered ones, and the index of the heading that starts
-- the appendix: with the Appendix setting on, `^app-name` below a top-level heading; sections are lettered from it.
local function number_headings(blocks, on)
  local nums, labels, off = {}, {}, {}
  local listed = {}
  for _, h in ipairs(SETTINGS.unnumbered) do listed[heading_key(pandoc.Inlines(h))] = true end
  local top = math.huge
  for _, b in ipairs(blocks) do if b.t == "Header" then top = math.min(top, b.level) end end
  local counters, skip_below, appendix = { 0, 0, 0 }, nil, nil
  for i, h in ipairs(blocks) do
    if h.t == "Header" then
      local lab = label_of(blocks[i + 1])
      local dash = lab and lab:sub(1, 1) == "-"
      if dash then lab = lab:sub(2) end
      if lab and lab ~= "" then labels[i] = lab end
      if not on then
      elseif skip_below and h.level > skip_below then off[i] = true
      elseif dash or (not lab and listed[heading_key(h.content)]) then off[i] = true; skip_below = h.level
      else
        skip_below = nil
        local depth = h.level - top + 1
        if SETTINGS.appendix and depth == 1 and not appendix and lab and lab:match("^app%-") then
          appendix, counters = i, { 0, 0, 0 }
        end
        if depth <= 3 then
          counters[depth] = counters[depth] + 1
          for k = depth + 1, 3 do counters[k] = 0 end
          local parts = { table.unpack(counters, 1, depth) }
          if appendix then parts[1] = string.char(64 + counters[1]) end
          nums[i] = table.concat(parts, ".")
        end
      end
    end
  end
  return nums, labels, off, appendix
end

-- macOS returns file names in NFD (й = и + U+0306, ё = е + U+0308); links in the text are NFC.
-- Obsidian's comments `%%…%%` are not shown, so they are dropped; fenced code is left as it is.
-- An unclosed `%%` comments out the rest, as in Obsidian.
local function strip_comments(text)
  if not text:find("%%%%") then return text end
  local out, chunk, fence = {}, {}, nil
  local function flush()
    local t = table.concat(chunk, "\n"):gsub("%%%%.-%%%%", ""):gsub("%%%%.*$", "")
    out[#out + 1] = t; chunk = {}
  end
  for line in (text:gsub("\r\n", "\n") .. "\n"):gmatch("(.-)\n") do
    local f = line:gsub("^[%s>]*", ""):match("^([`~][`~][`~]+)")
    if fence then
      out[#out + 1] = line
      if f and f:sub(1, 1) == fence:sub(1, 1) and #f >= #fence then fence = nil end
    elseif f then
      flush(); fence = f; out[#out + 1] = line
    else
      chunk[#chunk + 1] = line
    end
  end
  flush()
  return table.concat(out, "\n")
end

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
        local doc = pandoc.read(strip_comments(text), READER)
        if doc.blocks[1] and doc.blocks[1].t == "Header" and title_heading(doc) then doc.blocks:remove(1) end
        local nums, labels = number_headings(doc.blocks, numbered(doc))
        local kinds
        numbers, kinds = number_labels(doc.blocks, nums, number_within(doc))
        -- A statement shows its name, or its name and title, when the setting asks so.
        local l = detect_lang(doc)
        for lab, kind in pairs(kinds) do
          if SETTINGS.refShows ~= "number" then
            local name = NAMES[l][kind.type] .. " " .. numbers[lab]
            if SETTINGS.refShows == "full" and #kind.title > 0 then name = name .. " (" .. pandoc.utils.stringify(kind.title) .. ")" end
            numbers[lab] = name
          end
        end
        for i, lab in pairs(labels) do numbers[lab] = nums[i] or doc.blocks[i].content end
      end
    end
    note_cache[note] = numbers
  end
  return note_cache[note][label]
end

-- ---------- inline: wiki links, embeds, proofs ----------

local local_labels, local_texts, local_kinds = {}, {}, {}

local function wikilink(content)
  local target, alias = content:match("^([^|]*)|(.*)$")
  target = target or content
  local note, label = target:match("^(.-)#%^([%w_-]+)$")
  local hnote, heading = target:match("^([^#]*)#.-([^#]+)$")
  -- A link to a heading by its name shows the name, as in Obsidian.
  if heading and not label and not alias then return pandoc.Str(heading) end
  if label and not alias then
    if note == "" then
      if local_texts[label] then return pandoc.Span(local_texts[label]) end
      local shown = local_labels[label]
      local kind = local_kinds[label]
      if shown and kind and SETTINGS.refShows ~= "number" then
        local tex = NAMES[lang][kind.type] .. "~\\ref{" .. label .. "}"
        if SETTINGS.refShows == "full" and #kind.title > 0 then tex = tex .. " (" .. latex(kind.title) .. ")" end
        return pandoc.RawInline("latex", tex)
      end
      -- Equations are referred to with parentheses, as the plugin shows them: \eqref.
      if shown then return pandoc.RawInline("latex", (shown:match("^%(") and "\\eqref{" or "\\ref{") .. label .. "}") end
      return pandoc.Str("??")
    end
    -- A number, or the inlines of a heading without a number.
    local shown = external_number(note, label) or "??"
    return type(shown) == "string" and pandoc.Str(shown) or pandoc.Span(shown)
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
      local caption = NAMES[lang].proof .. "."
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

local function theorem_header(within)
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
  if within then table.insert(t, "\\numberwithin{theorem}{section}\\numberwithin{equation}{section}") end
  table.insert(t, "\\makeatletter\\newcommand{\\tcsetlabel}[1]{\\def\\@currentlabel{#1}}\\makeatother")
  return pandoc.RawBlock("latex", table.concat(t, "\n"))
end

function Pandoc(doc)
  local input = PANDOC_STATE.input_files
  if #input == 1 and input[1] ~= "-" then
    local f = io.open(input[1], "r")
    local text = f and f:read("a")
    if f then f:close() end
    if text and text:find("%%%%") then doc.blocks = pandoc.read(strip_comments(text), READER).blocks end
  end
  lang = detect_lang(doc)
  doc.meta.lang = pandoc.MetaString(lang)

  local on = numbered(doc)
  doc.meta.numbersections = on

  -- With `thm-title-heading` (or the setting) the heading that opens the note becomes the title.
  if not doc.meta.title and doc.blocks[1] and doc.blocks[1].t == "Header" and title_heading(doc) then
    doc.meta.title = pandoc.MetaInlines(doc.blocks[1].content)
    doc.blocks:remove(1)
  end

  -- Sections: the top level present becomes \section, three levels are numbered, as in the plugin.
  -- A label below a heading becomes its identifier, and the label line is dropped.
  local nums, labels, off, appendix = number_headings(doc.blocks, on)
  local top = math.huge
  for _, b in ipairs(doc.blocks) do if b.t == "Header" then top = math.min(top, b.level) end end
  local blocks = pandoc.List()
  for i, b in ipairs(doc.blocks) do
    if i == appendix then blocks:insert(pandoc.RawBlock("latex", "\\appendix")) end
    if b.t == "Header" then
      b.level = b.level - top + 1
      if off[i] then b.classes:insert("unnumbered") end
      local lab = labels[i]
      if lab then
        b.identifier = lab
        if nums[i] then local_labels[lab] = nums[i] else local_texts[lab] = b.content:clone() end
      end
    end
    if not (doc.blocks[i - 1] and doc.blocks[i - 1].t == "Header" and label_of(b)) then blocks:insert(b) end
  end
  doc.blocks = blocks
  if on and not doc.meta.secnumdepth then doc.meta.secnumdepth = pandoc.MetaString("3") end

  -- Labels of numbered statements and equations in this note; links to anything else print "??".
  local numbers, kinds = number_labels(doc.blocks)
  for lab, shown in pairs(numbers) do local_labels[lab] = shown end
  local_kinds = kinds

  doc = doc:walk({ Inlines = process_inlines })
  doc = doc:walk({ Blocks = process_blocks })

  -- \newtheorem is allowed in the body; header-includes would be overridden by include-in-header.
  -- Within sections only when there are numbered sections, as in the plugin; otherwise LaTeX would print 0.1.
  local tops = false
  for _, n in pairs(nums) do if not n:find("%.") then tops = true end end
  doc.blocks:insert(1, theorem_header(on and tops and number_within(doc)))
  return doc
end
