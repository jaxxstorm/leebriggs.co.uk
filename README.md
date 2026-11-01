# leebriggs.co.uk

Lee Briggs's personal website and blog, built with Jekyll.

## Local development

Install Ruby 3.4.12 (see `.ruby-version`) and Bundler, then run:

```sh
bundle install
bundle exec rake serve
```

Open <http://127.0.0.1:4000>. Posts live in `_posts`, page content in
`pages`, templates in `_layouts` and `_includes`, and styles in `assets/css`.
`index.md` is the homepage. Site settings are in `_config.yml`.

## Checks and production builds

```sh
JEKYLL_ENV=production bundle exec rake test
bundle exec rake audit
```

The build produces `_site/`; publish only that directory. GitHub Actions
builds the site and audits the locked Ruby dependencies on pushes, pull
requests, and a weekly schedule.

## Cloudflare Pages

The v3 build image reads `.ruby-version`, which pins the same Ruby version
used locally and in CI. Configure these Pages settings for production and
preview builds:

- Build command: `bundle exec jekyll build --strict_front_matter`
- Build output directory: `_site`
- Environment variable: `JEKYLL_ENV=production`

Remove any old `RUBY_VERSION` override, or set it to `3.4.12` to match
`.ruby-version`. Bundler uses the version recorded in `Gemfile.lock`.
This Jekyll build does not require a Node.js version override.

## Maintenance

Commit `Gemfile.lock` so local and CI builds use the same dependencies.
Dependabot proposes weekly Ruby and GitHub Actions updates. To update locally:

```sh
bundle update
bundle exec rake test audit
```

The editorial design is self-contained: local CSS, system fonts, and Jekyll's
built-in Rouge syntax highlighting. No browser framework or theme is required.
Analytics is disabled by default; set `g_track_id` to a GA4 measurement ID
if needed. Keep credentials outside this repository and the generated site.

## Design preview

This branch contains **Modern Ledger**, a crisp editorial design with a left-aligned
masthead, green accents, serif headlines, and a sans-serif reading column.

```sh
mise exec ruby@3.4.12 -- bundle exec jekyll serve --host 127.0.0.1 --port 4003
```

The homepage, writing index, articles, projects, and supporting pages share
custom layouts in `_layouts` and styles in `assets/css/main.css`.
Historical copyright notices are retained in [LICENSE](LICENSE).
