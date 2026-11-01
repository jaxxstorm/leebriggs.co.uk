desc 'Build the site and validate front matter'
task :test do
  sh "bundle exec jekyll build --strict_front_matter --trace"
  sh "bundle exec jekyll doctor"
end

desc 'Serve the site locally'
task :serve do
  sh "bundle exec jekyll serve --host 127.0.0.1"
end

desc 'Check locked dependencies for known vulnerabilities'
task :audit do
  sh "bundle exec bundler-audit check --update"
end

task default: :test
