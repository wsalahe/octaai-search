# OctaAi Search

A private, open-source search front end. No ads, no trackers, no cookies, no logs.

**Live: https://wsalahe.github.io/octaai-search/**

<p>
  <img width="192" alt="OctaAi logo" src="https://github.com/user-attachments/assets/1413b9fb-73d0-43f7-9caf-6877a4ba9bf7" />
</p>

**[Watch the intro video](https://github.com/user-attachments/assets/3a99a6f5-5a42-422f-9fe2-73c008904ae1)**

## What it does

- Web results from volunteer-run [SearXNG](https://searxng.org/) metasearch nodes (aggregating Google, Bing and more) with the independent [Marginalia Search](https://marginalia.nu/) index as a fallback (Marginalia results CC-BY-NC-SA 4.0)
- Instant answers from Wikipedia
- English and Arabic interface
- The default home page and search engine of the [OctaAi browser](https://github.com/wsalahe/OctaAi)

## Privacy, honestly

The page stores nothing and talks only to the search APIs needed to answer you. Your query is sent over HTTPS to a volunteer-run SearXNG metasearch node (and Wikipedia for instant answers); like any search backend, that node can see the queries it answers. We never see, log, or sell them.

## Hosting

Static site on GitHub Pages from this repo's `main` branch. No build step, no server, no account needed.

## License

MIT.
