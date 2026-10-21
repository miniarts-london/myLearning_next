from app.chunking import chunk_text, html_to_text


def test_html_becomes_one_block_per_line():
    html = "<h2>Contrast</h2><p>Text needs <strong>4.5:1</strong>.</p><ul><li>Large text: 3:1</li><li>Icons: 3:1</li></ul><script>alert(1)</script>"
    assert html_to_text(html) == "Contrast\nText needs 4.5:1.\n- Large text: 3:1\n- Icons: 3:1"


def test_short_text_is_one_chunk():
    assert chunk_text("One short paragraph.") == ["One short paragraph."]
    assert chunk_text("   ") == []


def test_long_text_is_split_with_overlap_and_nothing_lost():
    lines = [f"Line {i} " + "word " * 20 for i in range(40)]
    chunks = chunk_text("\n".join(lines), max_chars=400, overlap=80)
    assert len(chunks) > 1
    assert all(len(c) <= 400 + 80 + 1 for c in chunks)
    joined = "\n".join(chunks)
    assert all(f"Line {i} " in joined for i in range(40))  # every line is in some chunk
    assert chunks[1].startswith(chunks[0][-80:].lstrip()[:20])  # chunks overlap


def test_a_very_long_line_is_cut_on_word_boundaries():
    chunks = chunk_text("word " * 600, max_chars=300, overlap=50)
    assert len(chunks) > 1
    assert all(not c.endswith("wor") for c in chunks)
