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

  function isArabic(s) { return /[؀-ۿ]/.test(s); }
  function setStatus(html) {
    if (!html) { statusEl.hidden = true; statusEl.innerHTML = ""; return; }
    statusEl.hidden = false; statusEl.innerHTML = html;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function stripTags(s) { return String(s).replace(/<[^>]*>/g, ""); }
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
  function section(title, html) {
    return "<h3 class=\"sec-title\">" + esc(title) + "</h3>" + html;
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
    }).catch(function () { /* optional */ });
  }

  function wikiResults(q) {
    var wiki = wikiLang(q);
    var api = "https://" + wiki + "/w/api.php?action=query&list=search&srlimit=10&format=json&origin=*&srsearch=" + encodeURIComponent(q);
    return withTimeout(fetch(api).then(function (r) { return r.json(); }), 8000).then(function (d) {
      var hits = (d && d.query && d.query.search) || [];
      return hits.map(function (h) {
        return {
          url: "https://" + wiki + "/wiki/" + encodeURIComponent(h.title.replace(/ /g, "_")),
          title: h.title,
          desc: stripTags(h.snippet || "")
        };
      });
    });
  }

  function marginaliaResults(q) {
    return withTimeout(
      fetch("https://api.marginalia.nu/public/search/" + encodeURIComponent(q) + "?count=15")
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
      9000
    ).then(function (d) {
      return ((d && d.results) || []).map(function (it) {
        return { url: it.url, title: it.title, desc: it.description || "" };
      });
    });
  }

  function searxResults(q) {
    return withTimeout(
      fetch("https://search.rhscz.eu/search?q=" + encodeURIComponent(q) + "&format=json", { headers: { "Accept": "application/json" } })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
      9000
    ).then(function (d) {
      return ((d && d.results) || []).slice(0, 15).map(function (it) {
        return { url: it.url, title: it.title, desc: it.content || "" };
      });
    });
  }

  function renderAll(q) {
    setStatus("<span class=\"spinner\"></span>Searching...");
    resultsEl.hidden = true; resultsEl.innerHTML = "";
    instantEl.hidden = true; instantEl.innerHTML = ""; instantEl.removeAttribute("dir");
    creditsEl.hidden = true;
    metaLink.href = META_URL + encodeURIComponent(q);

    renderInstant(q);

    var webDone = false, wikiDone = false, webItems = [];
    function maybeFinishStatus() {
      if (!wikiDone || !webDone) return;
      if (!resultsEl.innerHTML) {
        setStatus("Nothing came back for \u201C" + esc(q) + "\u201D. Try different words, or <a style=\"color:var(--teal)\" href=\"" + metaLink.href + "\" rel=\"noopener\">widen this search with SearXNG metasearch</a>.");
      } else {
        setStatus("");
        if (!webItems.length) {
          setStatus("<span style=\"font-size:.85rem\">Web index is busy right now; showing knowledge results. <a style=\"color:var(--teal)\" href=\"" + metaLink.href + "\" rel=\"noopener\">Widen with SearXNG metasearch</a></span>");
        }
      }
      creditsEl.hidden = false;
    }

    wikiResults(q).then(function (items) {
      wikiDone = true;
      if (items.length) {
        var html = "";
        items.forEach(function (it, i) { html += card(it, i); });
        resultsEl.innerHTML += section(isArabic(q) ? "نتائج المعرفة (ويكيبيديا)" : "Knowledge results (Wikipedia)", html);
        resultsEl.hidden = false;
      }
      maybeFinishStatus();
    }).catch(function () { wikiDone = true; maybeFinishStatus(); });

    // Web index: first source that answers wins
    Promise.any([marginaliaResults(q), searxResults(q)]).then(function (items) {
      webDone = true; webItems = items || [];
      if (webItems.length) {
        var html = "";
        webItems.forEach(function (it, i) { html += card(it, i); });
        resultsEl.innerHTML += section(isArabic(q) ? "نتائج الويب" : "Web results", html);
        resultsEl.hidden = false;
      }
      maybeFinishStatus();
    }).catch(function () { webDone = true; maybeFinishStatus(); });
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
