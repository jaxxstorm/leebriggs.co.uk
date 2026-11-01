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

Browser dependencies are versioned in `_includes/externals/styling.html`.
When updating them, regenerate their SHA-384 Subresource Integrity hashes
and check the homepage, blog posts, and project interactions in a browser.
Analytics is disabled by default; set `g_track_id` to a GA4 measurement ID
if needed. Keep credentials outside this repository and the generated site.

## Credits and license

Based on [Pudhina Fresh](https://github.com/ritijjain/pudhina-fresh), adapted
from [Pudhina](https://github.com/knhash/Pudhina) by Shashank S.
See [LICENSE](LICENSE).
