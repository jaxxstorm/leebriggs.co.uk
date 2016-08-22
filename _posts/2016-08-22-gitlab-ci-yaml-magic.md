---
layout: post
title: Magic with Gitlab CI
category: blog
tags:
  - gitlab
---

I love [Gitlab](https://gitlab.com). With every release they announce some amazing new features and it's one of the few software suites I consider to be a joy to use. Since we adopted it at $job we've seen our release cycle within the OPS team improve dramatically and pushing new software seems to be a breeze.

My favourite part of Gitlab is the flexibility and robustness of the [gitlab-ci.yml](http://docs.gitlab.com/ce/ci/yaml/README.html) file. Simply by adding a file to your repository, you can now have complex pipeline running tasks which can test, build and deploy your software. I remember doing things like this with Jenkins and being incredibly frustrated - with gitlab I seem to be able to do everything I need to without all the fuss.

I also make heavy use of [travis-ci](https://travis-ci.org) in my public and open source projects, and I really like the [matrix feature](https://docs.travis-ci.com/user/customizing-the-build#Build-Matrix) that Travis offers. Fortunately, there's a similar (but not quite the same) feature available in Gitlab CI but I feel like the [documentation](http://docs.gitlab.com/ce/ci/yaml/README.html#special-yaml-features) is lacking a little bit, so I figured I'd write up a step by step guide to how I've started to use these features for our pipelines.

## An starting example

Let's say you have a starting .gitlab-ci.yml like so:

{% highlight yaml %}
---
stages:
  - test
  - build
  - deploy

build_rpm_centos6:
  image: centos:6
  script: 
    - rpmbuild -ba
  except:
    - tags
    - master
  stage: build
  tags:
    - docker

build_rpm_centos7:
  image: centos:7
  script:
    - rpmbuild
  except:
    - tags
    - master
  stage: build
  tags:
    - docker
{% endhighlight %}

This is a totally valid file, but there's a whole load of repetition in here which really shouldn't need to be here. We can use some features of [yaml](https://en.wikipedia.org/wiki/YAML) called [anchors and aliases](https://en.wikipedia.org/wiki/YAML#Advanced_components_of_YAML) which allow us to reduce the amount of code here. This is documented [here](http://docs.gitlab.com/ce/ci/yaml/README.html#special-yaml-features) in the Gitlab CI Readme, but I want to break it down into sections.

## Define a hidden job

Firstly, we need to define a ["hidden job"](http://docs.gitlab.com/ce/ci/yaml/README.html#hidden-jobs) - this is essentially of course a job gitlab-ci is aware of but doesn't actually run. It defines a yaml hash which we can merge into another hash later. We'll take all of the hash values from the above two jobs that are the same, and place it in that hidden job:

{% highlight yaml %}
# here we define a hidden job called "build" (prefixed with a dot)
# and then we assign it to an alias &build_definition
.build: &build_definition
  script:
    - rpmbuild -ba
  except:
    - tags
    - master
  stage: build
  tags:
    - docker
{% endhighlight %}

What this has done is essentially created something _like_ a function. When we _call_ &build_definition, it'll spit out the following yaml hash:

{% highlight yaml %}
---
  script:
    - rpmbuild -ba
  except:
    - tags
    - master
  stage: build
  tags:
    - docker
{% endhighlight %}

As you can see, the above yaml hash is only missing 2 things: A parent hash key and the value for "image".

## Reduce the code

In order to make use of this alias, we first need to actually define our build jobs. Remember, the above job is _hidden_ so if we pushed to our git repo right now, nothing would happen. Let's define our two build jobs.
{% highlight yaml %}
build_centos6:
  image: centos:6

build_centos7:
  image: centos:7
{% endhighlight %}

Obviously, this isn't enough to actually run a build. What we now need to do is merge to two hashes from the hidden job/alias and with our build definition.

{% highlight yaml %}
build_centos6:
  <<: *build_definition # this essentially says insert the hash values from &build_definition hash
  image: centos:6

build_centos7:
  <<: *build_definition
  image: centos:7
{% endhighlight %}

That's a lot less code duplication, and if you know what you're looking at, it's much easier to read.

## Visualising your gitlab-ci.yml file

This all might seem a little confusing at first because it's hard to visualise. The best way to get your head around what the output of your CI file is, is to remember that all Gitlab CI does when you push the file is load it into a hash and read the values. With that in mind, try this little 1 line script on your file:

{% highlight bash %}
ruby -e "require 'yaml'; require 'pp'; hash = YAML.load_file('.gitlab-ci.yml'); pp hash"
{% endhighlight %}

This is what the original yaml file hash looks like:

{% highlight ruby %}
{"stages"=>["test", "build", "deploy"],
 "build_rpm_centos6"=>
  {"image"=>"centos:6",
   "script"=>["rpmbuild -ba"],
   "except"=>["tags", "master"],
   "stage"=>"build",
   "tags"=>["docker"]},
 "build_rpm_centos7"=>
  {"image"=>"centos:7",
   "script"=>["rpmbuild"],
   "except"=>["tags", "master"],
   "stage"=>"build",
   "tags"=>["docker"]}}
{% endhighlight %}

And this is what the hash from the file with the anchors and such like contains:

{% highlight ruby %}
{"stages"=>["test", "build", "deploy"],
 ".build"=>
  {"script"=>["rpmbuild -ba"],
   "except"=>["tags", "master"],
   "stage"=>"build",
   "tags"=>["docker"]},
 "build_centos6"=>
  {"script"=>["rpmbuild -ba"],
   "except"=>["tags", "master"],
   "stage"=>"build",
   "tags"=>["docker"],
   "image"=>"centos:6"},
 "build_centos7"=>
  {"script"=>["rpmbuild -ba"],
   "except"=>["tags", "master"],
   "stage"=>"build",
   "tags"=>["docker"],
   "image"=>"centos:7"}}
{% endhighlight %}

Hopefully that makes it easier to understand! As mentioned earlier, this isn't as powerful (yet?) as Travis's matrix feature, which can quickly expand your jobs multiple times over, but with nested aliases you can easily have quite a complex matrix.
