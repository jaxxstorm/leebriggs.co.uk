---
title: Why the fuck are we templating yaml?
layout: post
category: blog
tags:
  - kubernetes
  - configuration mgmt
  - jsonnet
  - helm
  - kr8
---

I was at [cfgmgmtcamp 2019](https://cfgmgmtcamp.eu) in Ghent, and did a talk which I think was well received about the need for some Kubernetes configuration management as well as the solution we built for it at $work, [kr8](https://kr8.rocks).

I made a statement during the talk which ignited some fairly fierce discussion both online, and at the conference:

<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr">&quot;If you&#39;re starting to template yaml, ask yourself the question: why am I not *generating* json?&quot; - <a href="https://twitter.com/briggsl?ref_src=twsrc%5Etfw">@briggsl</a> spitting straight fire at <a href="https://twitter.com/hashtag/cfgmgmtcamp?src=hash&amp;ref_src=twsrc%5Etfw">#cfgmgmtcamp</a></p>&mdash; 🌈eric sorenson 🌊 (@ahpook) <a href="https://twitter.com/ahpook/status/1092810831216197643?ref_src=twsrc%5Etfw">February 5, 2019</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

To put this into my own words:

> At some point, we decided it was okay for us to template yaml. When did this happen? How is this acceptable?

After some conversation, I figured it was probably best to back up my claims in some way. This blog post is going to try to do that.

## The configuration problem

Once the applications and infrastructure you're going to manage grows past a certain size, you inevitably end up in some form of configuration complexity hell. If you're only deploying 1 or maybe 2 things, you can write a yaml configuration file and be done with it. However once you grow beyond that, you need to figure out how to manage this complexity. It's incredibly likely that the reason you have multiple configuration files is because the $thing that uses that config is slightly different from its companions. Examples of this include:

  - Applications deployed in different environments, like dev, stg and prod
  - Applications deployed in different regions, like Europe or North American

Obviously, not _all_ the configuration is different here, but it's likely the configuration differs enough that you want to be able to differentiate between the two.

This configuration complexity has been well known for Operators (System Administrators, DevOps engineers, whatever you want to call them) for some years now. An entire discpline grew up around this in Configuration Management, and each tool solved this problem in their own way, but ultimately, they used YAML to get the job done.

My favourite method has always been [hiera](https://puppet.com/docs/puppet/6.2/hiera_intro.html) which comes bundled with Puppet. Having the ability to hierarchically look up the variables of specific config needs is incredibly powerful and flexible, and has generally meant you don't actually need to do any templating of yaml at all, except perhaps for embedding Puppet facts into the yaml.

## Did we go backwards?

Then, as our industries' needs moved above the operating system and into cloud computing, we had a whole new data plane to configure. The tooling to configure this changed, and tools like [CloudFormation](https://aws.amazon.com/cloudformation/) and [Helm](https://helm.sh/) appeared. These tools are excellent configuration tools, but I firmly believe we (as an industry) got something really, really wrong when we designed them. To examine that, let's take a look at example of a helm chart taking a custom parameter

### Helm Charts

Helm charts can take external parameters defined by an `values.yaml` file which you specify when rendering the chart. A simple example might look like this:

Let's say my external parameter is simple - it's a string. It'd look a bit like this:

{% assign var = "{{ .Values.image }}" %}

{% highlight go %}
image: "{{ var }}"
{% endhighlight %}

That's not so bad right? You just specify a value for `image` in your values.yaml and you're on your way.

The real problem starts to get highlighted when you want to do more complicated and complex things. In this particular example, you're doing okay because you _know_ you have to specify an image for a Kubernetes deployment. However, what if you're working with something like an optional field? Well, then it gets a little more unwieldy:

{% highlight go %}
{{ "{{- with .resourceGroup " }} }}
    resourceGroup: {{ "{{ . " }} }}
{{ "{{- end"  }} }}
{% endhighlight %}

Optional values just make things ugly in templating languages, and you can't just leave the value blank, so you have to resort to ugly loops and conditionals that are probably going to bite you later.

Let's say you need to go a step further, and you need to push an array or map into the config. With helm, you'd do something like this.

{% highlight go %}
{{   "{{- with .Values.podAnnotations " }} }}
      annotations:
{{ "{{ toYaml . | indent 8 " }} }}
{{ "{{- end " }} }}
{% endhighlight %}

Firstly, let's ignore the madness of having a templating function `toYaml` to convert yaml to yaml and focus more on the whitespace issue here.

YAML has strict requirements and whitespace implementation rules. The following, for example, is not valid or complete yaml:

{% highlight yaml %}
something: nothing
  hello: goodbye
{% endhighlight %}

Generally, if you're handwriting something, this isn't necessarily a problem because you just hit backspace twice and it's fixed. However, if you're generating YAML using a templating system, you can't do that - and if you're operating above 5 or 10 configuration files, you probably want to be _generating_ your config rather than writing it.
 
So, in the above example, you want to embed the values of `.Values.podAnnotations` under the annotations field, which is indented already. So you're having to not only indent your values, but indent them correctly.

What makes this _even more confusing_ is that the go parser doesn't actually know anything about YAML at all, so if you try to keep the syntax clean and indent the templates like this:

{% highlight go %}
{{  "{{- with .Values.podAnnotations" }} }}
      annotations:
      {{ "{{ toYaml . | indent 6" }} }}
{{  "{{- end " }} }}
{% endhighlight %}

You actually can't do that, because the templating system gets confused. This is a singular example of the complexity and difficulty you end up facing when generating config data in YAML, but when you really start to do more complex work, it really starts to become obvious that this isn't the way to go.

Needless to say, this isn't what I want to spend _my_ time doing. If fiddling around with whitespace requirements in a templating system doing something it's not really designed for is what suits you, then I'm not going to stop you. I also don't want to spend my time writing configuration in JSON without comments and accidentally missing commas all over the shop. We (as an industry) decided a long time ago that shit wasn't going to work and that's why YAML exists. 

So what should we do instead? That's where [jsonnet](https://jsonnet.org) comes in.

## JSON, Jsonnet & YAML

Before we actually talk about Jsonnet, it's worth reminding people of a very important (but oft forgotten point). [YAML is a superset of JSON](https://yaml.org/spec/1.2/spec.html#id2759572) and converting between the two is trivial. Many applications and programming languages will parse JSON and YAML natively, and many can convert between the two very simple. For example, in Python:

{% highlight  python %}
python -c 'import json, sys, yaml ; y=yaml.safe_load(sys.stdin.read()) ; print(json.dumps(y))'
{% endhighlight %}

So with that in mind, let's talk about Jsonnet.

### Welcome to the church of Jsonnet

Jsonnet is a relatively new, little known (outside the Kubernetes community?) language that calls itself a _data templating language_. It's definitely a good exercise to read and consume the Jsonnet [design rationale](https://jsonnet.org/articles/design.html) page to get an idea why it exists, but if I was going to define in a nutshell what its purpose is - it's to generate JSON config.

So, how does it help, exactly?

Well, let's take our earlier example - we want to generate some JSON config specifying a parameter (ie, the image string). We can do that very very easily with Jsonnet using external variables.

Firstly, let's define some Jsonnet:

{% highlight jsonnet %}
{

  image: std.extVar('image'),

}
{% endhighlight %}

Then, we can generate it using the Jsonnet command line tool, passing in the external variable as we need to:

{% highlight bash %}
jsonnet image.jsonnet -V image="my-image"
{
   "image": "my-image"
}
{% endhighlight %}

Easy!

### Optional fields

Before, I noted that if you wanted to define an optional field, with YAML templating you had to define if statements for everything. With Jsonnet, you're just defining code!

{% highlight jsonnet %}

// define a variable - yes, jsonnet also has comments
local rg = null;
{


  image: std.extVar('image'),
  // if the variable is null, this will be blank
  [if rg != null then 'resourceGroup']: rg,

}
{% endhighlight %}

The output here, because our variable is null, means that we never actually populate resourceGroup. If you specify a value, it will appear:

{% highlight bash%}
jsonnet image.jsonnet -V image="my-image" 
{
   "image": "my-image"
}
{% endhighlight %}

### Maps and parameters

Okay, now let's look at our previous annotation example. We want to define some pod annotations, which takes a YAML map as its input. You want this map to be configurable by specifying external data, and obviously doing that on the command line sucks (you'd be very unlikely to specify this with Helm on the command line, for example) so generally you'd use Jsonnet imports to this. I'm going to specify this config as a variable and then load that variable into the annotation:

{% highlight jsonnet %}
local annotations = {
  'nginx.ingress.kubernetes.io/app-root': '/',
  'nginx.ingress.kubernetes.io/enable-cors': true,
};

{
  metadata: { // annotations are nested under the metadata of a pod
    annotations: annotations,
  },

}
{% endhighlight %}

This might just be my bias towards Jsonnet talking, but this is so dramatically easier than faffing about with indentation that I can't even begin to describe it. 


### Additional goodies

The final thing I wanted to quickly explore, which is something that I feel can't really be done with Helm and other yaml templating tools, is the concept of manipulating existing objects in config.

Let's take our example above with the annotations, and look at the result file:

{% highlight json %}
{
   "metadata": {
      "annotations": {
         "nginx.ingress.kubernetes.io/app-root": "/",
         "nginx.ingress.kubernetes.io/enable-cors": true
      }
   }
}
{% endhighlight %}

Now, let's say for example I wanted to append a set of annotations to this annotations map. In any templating system, I'd probably have to rewrite the whole map.

Jsonnet makes this _trivial_. I can simply use the `+` operator to add something to this. Here's a (poor) example:

{% highlight jsonnet %}
local annotations = {
  'nginx.ingress.kubernetes.io/app-root': '/',
  'nginx.ingress.kubernetes.io/enable-cors': true,
};

{
  metadata: {
    annotations: annotations,
  },
} + { // this adds another JSON object
  metadata+: { // I'm using the + operator, so we'll append to the existing metadata
    annotations+: { // same as above
      something: 'nothing',
    },
  },
}
{% endhighlight %}

The end result is this:

{% highlight json %}
{
   "metadata": {
      "annotations": {
         "nginx.ingress.kubernetes.io/app-root": "/",
         "nginx.ingress.kubernetes.io/enable-cors": true,
         "something": "nothing"
      }
   }
}
{% endhighlight %}

Obviously, in this case, it's more code to this, but as your example get more complex, it becomes extremely useful to be able to manipulate objects this way.

## Kr8

We use all of these methods in [kr8](https://kr8.rocks) to make creating and manipulating configuration for multiple Kubernetes clusters easy and simple. I highly recommend you check it out if any of the concepts you've found here have found you nodding your head.








