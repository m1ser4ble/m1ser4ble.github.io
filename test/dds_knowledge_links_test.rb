require "jekyll"
require "minitest/autorun"
require "nokogiri"
require "tmpdir"
require "yaml"
require "date"
require "open3"
require "json"

class DDSKnowledgeLinksTest < Minitest::Test
  ROOT = File.expand_path("..", __dir__)
  SLUGS = %w[guide basics discovery-addressing qos history-persistence security device-adapters realtime-linux fault-diagnosis observability gva-losa].freeze
  Liquid::Template.register_filter(Jekyll::Filters)

  def fixture(id, links = [], series: "dds", title: id, url: "/dds/#{id.delete_prefix('dds-')}/")
    { "knowledge_id" => id, "knowledge_links" => links, "series" => series, "title" => title, "url" => url }
  end

  def render_fixture(page, posts, baseurl: "")
    path = File.join(ROOT, "_includes/knowledge-links.html")
    assert File.file?(path), "DDS relation include must exist"
    Dir.mktmpdir("dds-liquid-") do |directory|
      site = Jekyll::Site.new(Jekyll.configuration("source" => directory, "destination" => "#{directory}/_site", "baseurl" => baseurl, "url" => "https://example.test", "plugins" => [], "quiet" => true))
      html = Liquid::Template.parse(File.read(path)).render!({ "page" => page, "site" => { "posts" => posts } }, registers: { site: site })
      Nokogiri::HTML.fragment(html)
    end
  end

  def test_fixture_outbound_and_inverse_relations_use_only_dds_posts
    current = fixture("dds-a", ["dds-b", "dds-a", "dds-b", "foreign", "missing"])
    target = fixture("dds-b", [], title: "기초 <script> & \"인용\"", url: "/dds/b/?mode=1&label=\"b\"")
    source = fixture("dds-c", ["dds-a"])
    foreign = fixture("foreign", ["dds-a"], series: "other")
    document = render_fixture(current, [current, target, source, foreign], baseurl: "/preview")
    assert_equal ["/preview/dds/b/?mode=1&label=%22b%22"], document.css("[aria-labelledby='dds-related'] a").map { |a| a["href"] }
    assert_equal ["/preview/dds/c/"], document.css("[aria-labelledby='dds-backlinks'] a").map { |a| a["href"] }
    assert_equal "기초 <script> & \"인용\"", document.at_css("[aria-labelledby='dds-related'] a").text
    assert_empty document.css("script:not([src])"), "Titles must stay text, not become script markup"
    assert_equal "관련 개념", document.at_css("#dds-related").text
    assert_equal "이 글을 참조하는 글", document.at_css("#dds-backlinks").text
    assert_equal ["/preview/assets/css/dds-knowledge.css"], document.css("link[rel='stylesheet']").map { |node| node["href"] }
    assert_equal ["/preview/assets/js/dds-embed.js"], document.css("script[src]").map { |node| node["src"] }
  end

  def test_fixture_omits_empty_sections_and_non_dds_output
    isolated = fixture("dds-alone")
    document = render_fixture(isolated, [isolated])
    assert_empty document.css("section"), "Empty relations must have no headings or sections"
    assert_empty render_fixture(fixture("other", [], series: "other"), [isolated]).children
    assert_empty render_fixture({ "series" => "dds" }, [isolated]).children
  end

  def test_fixture_outbound_does_not_require_manually_reversed_metadata
    current = fixture("dds-a", ["dds-b"])
    target = fixture("dds-b")
    document = render_fixture(current, [current, target])
    assert_equal ["/dds/b/"], document.css("[aria-labelledby='dds-related'] a").map { |a| a["href"] }
    assert_empty document.css("[aria-labelledby='dds-backlinks']")
    inverse = render_fixture(target, [current, target])
    assert_equal ["/dds/a/"], inverse.css("[aria-labelledby='dds-backlinks'] a").map { |a| a["href"] }
    assert_empty inverse.css("[aria-labelledby='dds-related']")
  end

  # Metadata checks fail before publishing; Liquid does not invent missing targets.
  def metadata_errors(records)
    errors = []
    dds = records.select { |record| record[:data]["series"] == "dds" }
    ids = dds.map { |record| record[:data]["knowledge_id"] }
    dds.each do |record|
      data, path = record.values_at(:data, :path)
      id, links = data.values_at("knowledge_id", "knowledge_links")
      errors << "#{path}: missing knowledge_id" unless id.is_a?(String) && !id.strip.empty?
      errors << "#{path}: duplicate knowledge_id #{id}" if ids.count(id) > 1
      unless links.is_a?(Array) && links.all? { |target| target.is_a?(String) && !target.strip.empty? }
        errors << "#{path}: knowledge_links must be an array of nonempty IDs"
        next
      end
      errors << "#{path}: self link #{id}" if links.include?(id)
      errors << "#{path}: duplicate knowledge_links" unless links == links.uniq
      links.each { |target| errors << "#{path}: unknown target #{target}" unless ids.include?(target) }
      record.fetch(:body, "").scan(/\{%\s*post_url\s+['"]?([^\s'"%]+)['"]?\s*%\}/).flatten.each do |target|
        destination = records.find { |candidate| File.basename(candidate[:path], File.extname(candidate[:path])) == target }
        if destination.nil?
          errors << "#{path}: missing post_url target #{target}"
        elsif !links.include?(destination[:data]["knowledge_id"])
          errors << "#{path}: undeclared post_url target #{target}"
        end
      end
    end
    errors
  end

  def record(data, slug = data["knowledge_id"], body = "")
    { path: "2026-10-13-#{slug}.markdown", data: data, body: body }
  end

  def test_fixture_metadata_detects_missing_duplicate_self_and_unknown_ids
    valid = [record(fixture("dds-a", ["dds-b"])), record(fixture("dds-b"))]
    assert_empty metadata_errors(valid)
    cases = {
      "missing knowledge_id" => [record(fixture("dds-a").merge("knowledge_id" => nil))],
      "duplicate knowledge_id" => [record(fixture("dds-a")), record(fixture("dds-a"))],
      "self link" => [record(fixture("dds-a", ["dds-a"]))],
      "duplicate knowledge_links" => [record(fixture("dds-a", ["dds-b", "dds-b"])), record(fixture("dds-b"))],
      "unknown target" => [record(fixture("dds-a", ["missing"]))],
      "array of nonempty IDs" => [record(fixture("dds-a", "dds-b"))],
      "undeclared post_url target" => [record(fixture("dds-a"), "dds-a", "{% post_url 2026-10-13-dds-b %}"), record(fixture("dds-b"))],
      "missing post_url target" => [record(fixture("dds-a"), "dds-a", "{% post_url 2026-10-13-missing %}")]
    }
    cases.each { |message, records| assert metadata_errors(records).any? { |error| error.include?(message) }, "Expected #{message}" }
  end

  def actual_records
    Dir.glob(File.join(ROOT, "_posts/*.{markdown,md}")).map do |path|
      match = File.read(path).match(/\A---\s*\n(.*?)\n---\s*\n(.*)\z/m)
      next unless match
      { path: path, data: YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true), body: match[2] }
    end.compact
  end

  def test_actual_series_metadata_and_body_links
    records = actual_records
    series = records.select { |record| record[:data]["series"] == "dds" }
    assert_equal SLUGS.map { |slug| "dds-#{slug}" }.sort, series.map { |record| record[:data]["knowledge_id"] }.sort
    assert_empty metadata_errors(records)
    series.each do |record|
      slug = record[:data]["knowledge_id"].delete_prefix("dds-")
      assert_equal "2026-10-13-dds-#{slug}.markdown", File.basename(record[:path])
      assert_equal "/dds/#{slug}/", record[:data]["permalink"]
      assert_operator record[:data]["knowledge_links"].size, :>=, 2
      assert_equal 1, record[:body].scan(/\{%\s*include\s+knowledge-links\.html\s*%\}/).size, record[:path]
    end
    guide = series.find { |record| record[:data]["knowledge_id"] == "dds-guide" }
    assert_equal (SLUGS - ["guide"]).map { |slug| "dds-#{slug}" }.sort, guide[:data]["knowledge_links"].sort
  end

  def test_actual_media_assets_and_topic_routes
    player = File.join(ROOT, "assets/animations/dds/index.html")
    assert File.file?(player), "DDS player asset must exist"
    player_document = Nokogiri::HTML(File.read(player))
    player_document.css("script[src], link[rel='stylesheet'][href]").each do |asset|
      reference = asset["src"] || asset["href"]
      assert File.file?(File.expand_path(reference, File.dirname(player))), "Missing player asset: #{reference}"
    end
    scenes = File.join(ROOT, "assets/animations/dds/scenes.js")
    output, status = Open3.capture2e("node", "-e", "const fs=require('node:fs'),vm=require('node:vm'),context={window:{}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),context);process.stdout.write(JSON.stringify(context.window.ddsTopics));", scenes)
    assert status.success?, output
    assert_equal SLUGS.sort, JSON.parse(output).sort, "Every article must have a supported player topic"
    actual_records.select { |record| record[:data]["series"] == "dds" }.each do |record|
      slug = record[:data]["knowledge_id"].delete_prefix("dds-")
      frames = Nokogiri::HTML.fragment(record[:body]).css("iframe.dds-animation")
      assert_equal 1, frames.size, record[:path]
      assert_match %r{\{\{\s*['"]/assets/animations/dds/index\.html['"]\s*\|\s*relative_url\s*\}\}\?topic=#{Regexp.escape(slug)}\z}, frames.first["src"]
      assert_match /height:\s*760px/, frames.first["style"]
      refute_empty frames.first["title"].to_s
    end
    navigation = YAML.safe_load(File.read(File.join(ROOT, "_data/navigation.yaml")))
    assert_equal 1, navigation.fetch("main").count { |item| item["url"] == "/dds/guide/" }
  end

  def test_fixture_embed_resizes_only_a_same_origin_dds_frame_with_bounded_numeric_height
    path = File.join(ROOT, "assets/js/dds-embed.js")
    assert File.file?(path), "DDS resize script must exist"
    script = <<~JS
      const assert = require('node:assert/strict');
      const vm = require('node:vm');
      const fs = require('node:fs');
      let loadListener;
      const dds = { contentWindow: {}, style: { height: '760px' }, addEventListener: (name, handler) => { if (name === 'load') loadListener = handler; } };
      const other = { contentWindow: {}, style: { height: '760px' } };
      let listener;
      const context = {
        window: { location: { origin: 'https://example.test' }, addEventListener: (name, handler) => { if (name === 'message') listener = handler; } },
        document: { querySelectorAll: selector => selector === 'iframe.dds-animation' ? [dds] : [dds, other] }
      };
      vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), context);
      assert.equal(typeof listener, 'function');
      const send = (data, origin = 'https://example.test', source = dds.contentWindow) => listener({ data, origin, source });
      for (const data of [null, {}, {type:'other',height:900}, ...['900',0,-1,NaN,Infinity,2001].map(height => ({type:'dds-animation-height',height}))]) send(data);
      send({type:'dds-animation-height',height:900}, 'https://evil.test');
      send({type:'dds-animation-height',height:900}, 'https://example.test', other.contentWindow);
      assert.equal(dds.style.height, '760px');
      assert.equal(other.style.height, '760px');
      send({type:'dds-animation-height',height:901.5});
      assert.equal(dds.style.height, '902px');
      send({type:'dds-animation-height',height:2000});
      assert.equal(dds.style.height, '2000px');
      dds.contentDocument = { body: { getBoundingClientRect: () => ({height:1118.2}) } };
      loadListener();
      assert.equal(dds.style.height, '1119px');
      dds.style.height = '760px';
      vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), context);
      assert.equal(dds.style.height, '1119px', 'synchronize a child loaded before the parent script');
    JS
    output, status = Open3.capture2e("node", "-e", script, path)
    assert status.success?, output
  end
end
