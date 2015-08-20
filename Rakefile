require 'html/proofer'

task :test do
  sh "bundle exec jekyll build"
  HTML::Proofer.new("./_site", {
    :empty_alt_ignore => true,
    :verbose => false
  }).run
end
