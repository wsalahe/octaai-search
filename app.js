(function () {
  "use strict";
  var form = document.getElementById("search-form");
  var input = document.getElementById("q");
  var statusEl = document.getElementById("status");
  var instantEl = document.getElementById("instant");
  var resultsEl = document.getElementById("results");
  var creditsEl = document.getElementById("credits");
  var metaLink = document.getElementById("meta-link");
  var META_URL = "https://searx.be/search?q=";

  // Public SearXNG metasearch nodes (open source, volunteer-run).
  // They aggregate Google, Bing and other engines. First one that answers wins.
  var SEARX_NODES = [
    "https://search.rhscz.eu",
    "https://searx.be",
    "https://search.inetol.net",
    "https://priv.au",
    "https://paulgo.io",
    "https://baresearch.org"
  ];

  function isArabic(s) { return /[؀-ۿ]/.test(s); }
  function setStatus(html) {
    if (!html) { statusEl.hidden = true; statusEl.innerHTML = ""; return; }
    statusEl.hidden = false; statusEl.innerHTML = html;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function hostOf(u) { try { return new URL(u).hostname; } catch (e) { return u; } }
  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, ms); })]);
  }
  function card(it, i) {
    return "<article class=\"result\" style=\"animation-delay:" + Math.min(i * 30, 300) + "ms\">" +
      "<a class=\"title\" href=\"" + esc(it.url) + "\" rel=\"noopener\">" + esc(it.title || it.url) + "</a>" +
      "<span class=\"url\">" + esc(hostOf(it.url)) + "</span>" +
      (it.desc ? "<p class=\"desc\">" + esc(it.desc) + "</p>" : "") +
      "</article>";
  }

  function wikiLang(q) { return isArabic(q) ? "ar.wikipedia.org" : "en.wikipedia.org"; }

  function renderInstant(q) {
    var wiki = wikiLang(q);
    var api = "https://" + wiki + "/w/api.php?action=opensearch&limit=1&format=json&origin=*&search=" + encodeURIComponent(q);
    return withTimeout(fetch(api).then(function (r) { return r.json(); }), 8000).then(function (d) {
      if (!d || !d[1] || !d[1].length) return;
      var title = d[1][0];
      return withTimeout(fetch("https://" + wiki + "/api/rest_v1/page/summary/" + encodeURIComponent(title)), 8000)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (s) {
          if (!s || !s.extract) return;
          var url = (s.content_urls && s.content_urls.desktop) ? s.content_urls.desktop.page : d[3][0];
          instantEl.innerHTML =
            "<h2><a href=\"" + esc(url) + "\" rel=\"noopener\">" + esc(s.title || title) + "</a></h2>" +
            "<p>" + esc(s.extract) + "</p>" +
            "<span class=\"src\">Wikipedia</span>";
          instantEl.hidden = false;
          if (isArabic(q)) instantEl.setAttribute("dir", "rtl");
        });
    }).catch(function () { /* instant answer is optional */ });
  }

  function searxQuery(node, q) {
    return withTimeout(
      fetch(node + "/search?q=" + encodeURIComponent(q) + "&format=json", { headers: { "Accept": "application/json" } })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
      9000
    ).then(function (d) {
      var items = ((d && d.results) || []).slice(0, 20).map(function (it) {
        var engines = (it.engines || []).join(", ");
        return { url: it.url, title: it.title, desc: it.content || "", engines: engines };
      });
      if (!items.length) throw new Error("empty");
      return { node: hostOf(node), items: items };
    });
  }

  function marginaliaQuery(q) {
    return withTimeout(
      fetch("https://api.marginalia.nu/public/search/" + encodeURIComponent(q) + "?count=15")
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
      9000
    ).then(function (d) {
      var items = ((d && d.results) || []).map(function (it) {
        return { url: it.url, title: it.title, desc: it.description || "", engines: "marginalia" };
      });
      if (!items.length) throw new Error("empty");
      return { node: "api.marginalia.nu", items: items };
    });
  }

  function renderAll(q) {
    setStatus("<span class=\"spinner\"></span>Searching...");
    resultsEl.hidden = true; resultsEl.innerHTML = "";
    instantEl.hidden = true; instantEl.innerHTML = ""; instantEl.removeAttribute("dir");
    creditsEl.hidden = true;
    metaLink.href = META_URL + encodeURIComponent(q);

    renderInstant(q);

    var races = SEARX_NODES.map(function (n) { return searxQuery(n, q); });
    races.push(marginaliaQuery(q));

    Promise.any(races).then(function (win) {
      var html = "";
      win.items.forEach(function (it, i) { html += card(it, i); });
      var label = isArabic(q)
        ? "نتائج الويب (جوجل وبينج وغيرها عبر ميتا-بحث SearXNG)"
        : "Web results (Google, Bing and more via SearXNG metasearch)";
      if (win.node === "api.marginalia.nu") {
        label = isArabic(q) ? "نتائج الويب (فهرس Marginalia المستقل)" : "Web results (Marginalia independent index)";
      }
      resultsEl.innerHTML = "<h3 class=\"sec-title\">" + esc(label) + "</h3>" + html;
      resultsEl.hidden = false;
      setStatus("");
      creditsEl.hidden = false;
    }).catch(function () {
      setStatus("The metasearch nodes are busy right now. <a style=\"color:var(--teal)\" href=\"" + metaLink.href + "\" rel=\"noopener\">Open this search directly in SearXNG metasearch</a> (Google, Bing and more).");
      creditsEl.hidden = false;
    });
  }

  function run(q) {
    q = (q || "").trim();
    if (!q) return;
    document.body.classList.add("searched");
    document.title = q + " - OctaAi Search";
    renderAll(q);
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var q = input.value.trim();
    if (!q) return;
    try { history.pushState(null, "", "?q=" + encodeURIComponent(q)); } catch (e) { }
    run(q);
  });

  var initial = new URLSearchParams(location.search).get("q");
  if (initial) { input.value = initial; run(initial); }
})();
