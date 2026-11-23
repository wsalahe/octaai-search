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

  function hostOf(u) {
    try { return new URL(u).hostname; } catch (e) { return u; }
  }

  function renderInstant(q) {
    var wiki = isArabic(q) ? "ar.wikipedia.org" : "en.wikipedia.org";
    var api = "https://" + wiki + "/w/api.php?action=opensearch&limit=1&format=json&origin=*&search=" + encodeURIComponent(q);
    return fetch(api).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d[1] || !d[1].length) return;
      var title = d[1][0];
      return fetch("https://" + wiki + "/api/rest_v1/page/summary/" + encodeURIComponent(title))
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

  function renderResults(q) {
    setStatus("<span class=\"spinner\"></span>Searching...");
    resultsEl.hidden = true; resultsEl.innerHTML = "";
    instantEl.hidden = true; instantEl.innerHTML = ""; instantEl.removeAttribute("dir");
    creditsEl.hidden = true;
    metaLink.href = META_URL + encodeURIComponent(q);

    renderInstant(q);

    fetch("https://api.marginalia.nu/public/search/" + encodeURIComponent(q) + "?count=20")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        var items = (d && d.results) || [];
        if (!items.length) {
          setStatus("No results from the independent index for \u201C" + esc(q) + "\u201D. Try different words, or <a style=\"color:var(--teal)\" href=\"" + metaLink.href + "\" rel=\"noopener\">widen this search with SearXNG metasearch</a>.");
          creditsEl.hidden = false;
          return;
        }
        setStatus("");
        var html = "";
        items.forEach(function (it, i) {
          html += "<article class=\"result\" style=\"animation-delay:" + Math.min(i * 30, 300) + "ms\">" +
            "<a class=\"title\" href=\"" + esc(it.url) + "\" rel=\"noopener\">" + esc(it.title || it.url) + "</a>" +
            "<span class=\"url\">" + esc(hostOf(it.url)) + "</span>" +
            (it.description ? "<p class=\"desc\">" + esc(it.description) + "</p>" : "") +
            "</article>";
        });
        resultsEl.innerHTML = html;
        resultsEl.hidden = false;
        creditsEl.hidden = false;
      })
      .catch(function (err) {
        setStatus("The index did not answer (" + esc(err.message) + "). <a style=\"color:var(--teal)\" href=\"" + metaLink.href + "\" rel=\"noopener\">Open this search in SearXNG metasearch instead</a>.");
        creditsEl.hidden = false;
      });
  }

  function run(q) {
    q = (q || "").trim();
    if (!q) return;
    document.body.classList.add("searched");
    document.title = q + " - OctaAi Search";
    renderResults(q);
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var q = input.value.trim();
    if (!q) return;
    try {
      history.pushState(null, "", "?q=" + encodeURIComponent(q));
    } catch (e) { /* file:// etc. */ }
    run(q);
  });

  var initial = new URLSearchParams(location.search).get("q");
  if (initial) {
    input.value = initial;
    run(initial);
  }
})();
