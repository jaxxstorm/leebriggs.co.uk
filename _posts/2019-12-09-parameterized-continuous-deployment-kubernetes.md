---
title: Multi-Cluster Parameterized Continuous Deployment for Kubernetes
layout: post
category: blog
tags:
- argocd
- jkcfg
- kubernetes
- AWS
---

At `$work`, we have several Kubernetes clusters across different geographical and AWS regions. The reasons range from customer requirements, to our own desire to reduce operational "blast radius" issues that might come up. Our team has experience large outages before, and we try and build the smallest unit of deployment we possibly can for out platform.

Unfortunately, this brings with it new challenges, especially when it comes to running Kubernetes clusters. I've spoke extensively about this on this blog before, particularly regarding [configuration management needs](https://leebriggs.co.uk/blog/2018/05/08/kubernetes-config-mgmt.html) and the overhead that scaling out to multiple clusters brings.

As these clusters have become more utilized by application teams, a new consideration has arisen. Deploying regional applications has the same configuration complexity problems I've spoken about when it comes to the infrastructure management, and essentially the needs boil down to the same words we're familiar with: configuration management.

I set out to try and make the task of deploying applications to regional clusters as easy as possible for our teams following the same philosophy frustrations I had before. The requirements were a bit like this:

- [no templating languages](https://leebriggs.co.uk/blog/2019/02/07/why-are-we-templating-yaml.html) (no helm!)
- continuous deployment made easy
- easy for developers to grasp - low barrier to entry  
- abstract as much of configuration complexity away as possible

What I came up with works very nicely, and uses largely off the shelf tooling that you can replicate very easily.

This post is the first in what I hope will be a 2 part series of posts which covers the following topics:

  1. Generating regional/parameterised manifests using jkcfg
  2. Using Gitlab, Gitlab-CI, ArgoCD and GitOps to deploy to multiple clusters

## Part 1: Generate your config

It's the first step, but it's also the hardest. How do you generate your YAML configuration for the different clusters?

I looked at a few options here, like the now defunct [ksonnet](https://ksonnet.io/) as well as [Helm](https://helm.sh/) but they didn't really seem like optimal solutions. 

Ksonnet uses jsonnet, which for us infrastructure people didn't seem so bad (we used it in [kr8](https://github.com/apptio/kr8)) but there was very little desire for developers to actually learn this new and strange language for their application development needs. Luckily for me, it was deprecated just as I was trying to convince my developers otherwise, which meant I kept search for other solutions.

Helm is the defacto standard for this kind of thing but again, there were some confused questions when it came to the templating of YAML. I could sympathise with this, and at the time, Helm had some serious security problems with Tiller. Helm3 has largely addresses this, but I still can't bring myself to template yaml.

### jkcfg

It was around this time I became familiar with [jkcfg](https://jkcfg.github.io/#/) which caught my eye. I've used [Pulumi](http://pulumi.io/) before, so I was quite familiar with the idea of configuring my instrastructure using an actual programming language, and really liked the idea. What I didn't like about Pulumi was the way it directly interacted with clusters to do deployments. 
Jkcfg on the other hand keeps it simpler. It takes JavaScript (or typescript) and generates YAML documents for you. That's it. The YAML files it generates are idempotent and will regenerate the same each time. It can take parameters very easily, which fit in with my desire to have configuration values per cluster, and most importantly in its favour (as opposed to Helm and Jsonnet) it was a language native to most developers.

### Let's generate some manifests

Before I begin, I'd like to point out something important: _This was my first ever use of JavaScript_. If this sucks, please let me know!

The jkcfg repo has some excellent [examples](https://github.com/jkcfg/kubernetes/tree/master/examples) you can use, and getting started was generally pretty straightforward.

Download the jk binary

Init a repo using your favourite javascript dependency tool (yarn, for example)

```bash
yarn init
yarn init v1.15.2
question name (jkcfg-example):
question version (1.0.0):
question description: An example jkcfg deployment
question entry point (index.js):
question repository url: https://github.com/jaxxstorm/jkcfg-example
question author: Lee Briggs
question license (MIT): MIT
question private: no
success Saved package.json
✨  Done in 43.32s.
```

Add the `@jkcfg/kubernetes` package:

```bash
yarn add @jkcfg/kubernetes
yarn add v1.15.2
info No lockfile found.
[1/4] 🔍  Resolving packages...
[2/4] 🚚  Fetching packages...
[3/4] 🔗  Linking dependencies...
[4/4] 🔨  Building fresh packages...
success Saved lockfile.
success Saved 2 new dependencies.
info Direct dependencies
└─ @jkcfg/kubernetes@0.5.1
info All dependencies
├─ @jkcfg/kubernetes@0.5.1
└─ @jkcfg/std@0.3.2
✨  Done in 3.31s.
```

Okay, so we're ready to generate some manifests. A simple deployment might look like this:

```javascript
import * as k8s from '@jkcfg/kubernetes/api';
import * as std from '@jkcfg/std';

const deployment = new k8s.apps.v1.Deployment(`myapp`, { 
    metadata: {
      namespace: 'myapp',
    },
    spec: {
      replicas: 2,
      template: {
        spec: {
          containers: [{
            image: 'jaxxstorm/myapp:v0.1',
            imagePullPolicy: 'IfNotPresent',
            name: 'myapp',
            resources: {
              requests: {
                cpu: "500m",
                memory: "500Mi"
              },
              limits: {
                cpu: "2000m",
                memory: "2000Mi"
              }
            },
            ports: [{
              containerPort: 8080,
              protocol: 'TCP',
            }],
          }],
        },
      },
    }
  });

  const myapp = [
    deployment,
]

std.write(myapp, `manifests/myapp.yaml`, { format: std.Format.YAMLStream });
```

Once you have your deployment javascript file, you can generate a YAML document by running the `jk` command:

```bash
jk run index.js
```

### Parameters

Okay, we have a nice deployment manifest now, but how does this help me with different regions?

jkcfg supports "parameters" which can be passed either via a command line argument, or a file. This is similar to Helm's [values](https://helm.sh/docs/topics/chart_template_guide/values_files/) files which are evaluated at compile time. Using values in jkcfg is very straightforward. 

```javascript
// Import the param package
import * as param from '@jkcfg/std/param';

// declare a constant, replica which is set to the value of "replicas"
// and has a default of "1"
const replicas = param.Number('replicas', 1)
```

You can then use this value inside your deployment manifest. Here's the end result:

```javascript
import * as k8s from '@jkcfg/kubernetes/api';
import * as std from '@jkcfg/std';
import * as param from '@jkcfg/std/param';

const replicas = param.Number('replicas', 1)

const deployment = new k8s.apps.v1.Deployment(`myapp`, {
    metadata: {
      namespace: 'myapp',
    },
    spec: {
      replicas: replicas, // use the value from the param
      template: {
        spec: {
          containers: [{
            image: 'jaxxstorm/myapp:v0.1',
            imagePullPolicy: 'IfNotPresent',
            name: 'myapp',
            resources: {
              requests: {
                cpu: "500m",
                memory: "500Mi"
              },
              limits: {
                cpu: "2000m",
                memory: "2000Mi"
              }
            },
            ports: [{
              containerPort: 8080,
              protocol: 'TCP',
            }],
          }],
        },
      },
    }
  });

  const myapp = [
    deployment,
  ]

std.write(myapp, `manifests/myapp.yaml`, { format: std.Format.YAMLStream });
```

Once you've started using parameters, you probably don't always want to use the same number of replicas. You can invoke the parameters in two ways. The first, and easiest, is on the command line:

```bash
jk run index.js -p replicas=5
```

Check the manifest now in `manifests/myapp.yaml`: you'll see we've set the replicas to 5!

The other way of overriding the parameters is using a parameters file. This can be YAML or JSON. Create a file called `params/myapp.yaml` and populate it like so:

```bash
replicas: 100
```

Then use it with jk like so:

```bash
jk run -f params/myapp.yaml index.js
```

Easy!

### Abstract, abstract, abstract

As I went through this journey, it became apparent there was a lot of code reuse across different services. Most of the services we build are using the same frameworks, and need a lot of similar configuration.

For example, every service we deploy to Kubernetes needs 4 basic things:

- A deployment spec
  - With KIAM annotations
  - With security contexts
  - etc etc
- A service spec
- An ingress
- A configmap

As we went through this journey, I found myself writing a lot of repeatable javascript, and I wasn't getting a whole lot of value out of it.

Of course, because this configuration is written in JavaScript, we can take advantage of JavaScript packages to simplify the whole process. At this point, I built a (private) NPM package to abstract most of the code away from the end user. You can see an example of this kind of pattern in the [jkcfg documentation](https://jkcfg.github.io/#/documentation/quick-start/a-more-realistic-example)

Here's the repo contents:

```bash
.
├── README.md
├── index.js
├── kube.js
├── labels.js
├── package.json
└── yarn.lock
```

I'll break down the `js` files so we can get an idea of what this entails.

#### kube.js

The main meat of the package is in `kube.js`. Let's take a look at this:

```bash
import * as api from '@jkcfg/kubernetes/api';
import { Labels } from './labels';

function Deployment(service) {
  return new api.apps.v1.Deployment(service.name, {
    metadata: {
      namespace: service.namespace,
      labels: Labels(service),
      annotations: service.deployment.annotations,
    },
    spec: {
      selector: {
        matchLabels: Labels(service),
      },
      replicas: service.replicas,
      template: {
        metadata: {
          labels: Labels(service),
          annotations: service.deployment.annotations,
        },
        spec: {
          containers: [{
            name: service.name,
            image: `${service.deployment.image}:${service.version}`,
            imagePullPolicy: 'IfNotPresent',
            readinessProbe: {
              httpGet: {
                  path: '/healthcheck',
                  port: service.ports.health,
              },
              initialDelaySeconds: 10,
              timeoutSeconds: 10,
            },
            envFrom: [{
              configMapRef: {
                name: service.name,
              },
            }],
            ports: [{
              containerPort: service.ports.web,
            }, {
              containerPort: service.ports.health,
            }],
            resources: service.resources,
          }],
        },
      },
      securityContext: {
        runAsNonRoot: true,
        runAsUser: 65534,
      },
    },
  });
}

function Service(service) {
  return new api.core.v1.Service(service.name, {
    metadata: {
      namespace: service.namespace,
      labels: Labels(service),
    },
    spec: {
      selector: Labels(service),
      ports: [{
        name: 'web',
        port: service.ports.web,
        protocol: 'TCP',
        targetPort: service.ports.web,
      }, {
        name: 'health',
        port: service.ports.health,
        protocol: 'TCP',
        targetPort: service.ports.health,
      }],
    },
  });
}

function Ingress(service) {
  return new api.extensions.v1beta1.Ingress(service.name, {
    metadata: {
      namespace: service.namespace,
      labels: Labels(service),
      annotations: {
        'ingress.kubernetes.io/ssl-redirect': 'true',
        'kubernetes.io/ingress.class': service.ingress.class,
      },
    },
    spec: {
      rules: [{
            host: service.ingress.host,
            http: {
                paths: [{
                        path: '/',
                        backend: {
                            serviceName: service.name,
                            servicePort: service.ports.web,
                        },
                    },
                    {
                        path: '/health',
                        backend: {
                            serviceName: service.name,
                            servicePort: service.ports.health,
                        },
                }],
            },
      }],
    },
  });
}

export {
  Deployment,
  Ingress,
  Service,
};

```

Obviously this is a lot more involved than our previous, very simple deployment from earlier. What's worth noting though is that this is completely configurable by a `service` object in our jkcfg configuration parameter. I've gone for an approach here as well where we load the configuration variable from a configmap, which is _not_ managed by this module. That way, we can use a basic boilerplate module for _most_ of the stuff we want to deploy, and we can have a pretty high degree of confidence that the deployments meet our standards.

#### labels.js

This labels file is simply a way of ensuring we have the correct labels defined for all our resources. Here's what it looks like:

```javascript
export function Labels(service) {
    return {
        app: service.name,
        stage: service.tier,
        environment: service.environment,
        region: service.region,
    };
}
```

Notice, we're exporting this as a function. The "why" will become apparent later...

#### index.js

Finally, our `index.js` where we export all this to be used:

```javascript
import { Labels } from './labels';
import * as k from './kube';

export function KubeService(service) {
  return [
    k.Deployment(service),
    k.Service(service),
    k.Ingress(service),
  ];
}

export { Labels };
```

We now have a very basic NPM package. We can push this to git or to the NPM registry and let people use. So how do we actually use it?

### Using the package

Using this is pretty straightforward. First, add it as a dependency:

```bash
yarn add "git+https://github.com/jaxxstorm/jkcfg-example#master" # Pull the dep from git on the master branch
```

Then import it to be used in your jkcfg `index.js`:

```javascript
import * as param from '@jkcfg/std/param';
import * as api from '@jkcfg/kubernetes/api';
import * as std from '@jkcfg/std';
// Import the akp packages
import * as ks from '@jaxxstorm/jkcfg-example'; // This is my package name
```

Now we've imported it, the fun stuff starts. For your average person, you can generate the deployment, service and ingress with two files. First, pad out your `index.js` like so:

```javascript
// This reads the params file specified on the command line
const service = param.Object('service');
// Set the value of manifest (written to a file later) to the exported function
const manifest = ks.KubeServiceService(service);

// Write the contents of manifest to a manifest file
std.write(manifest, `manifests/${service.name}.yaml`, { format: std.Format.YAMLStream });
```

That's it! 10 lines of JavaScript to generate our Kubernetes manifest!

Before we get too excited, we need to populate our params file:

```yaml
service:
  name: myapp # the name of your service
  namespace: myapp # the namespace you want to deploy to
  # deployment specific config
  deployment:
    annotations: # a key value mapping, below is an example
      # 'iam.amazonaws.com/role': 'kiam-role
    image: jaxxstorm/myapp
  ingress:
    class: 'default'
    host: 'myapp.example.com' # the url you want to access you app on
  ports:
    web: 8080
    health: 8081
  resources:
    requests:
      cpu: "500m"
      memory: "500Mi"
    limits:
      cpu: "2000m"
      memory: "2000Mi"
  environment: dev
  tier: standard # only used for some config options, added as a label
  region: us-west-2
```

As you can see, the service object does most of the work for us, and we can tailor it per region or per environment as needed.

At this stage, we're ready to generate our manifests again. Let's use the command from before:

```bash
jk run deployment/kube/jk/index.js -o complex/manifests -f complex/params/dev/us-west-2.yaml -p version=0.0.1
```

Notice how we specify the version as a parameter outside the params file, simply because we expect this to be a dynamic value. I'll talk more about this in my next post.

This should have generated manifests for you in `complex/manifests` and now you're ready to do some deployments!

## Add a ConfigMap

The final part of this is the configuration. We've so far tried to build a jkcfg package that is as agnostic as possible, and can be reused across many different services and deployments.

The reality is though, you're still going to need to add configuration data for the service. We can utilise what we've got here and add a configmap to the equation which can be customised per-deployment very easily.

In your `index.js` add the following:

```javascript
// Read the params file for the config object
const config = param.Object('config');

// ConfigMaps are generally unique to each service
function ConfigMap(service) {
    return new api.core.v1.ConfigMap(service.name, {
        metadata: {
            namespace: service.namespace,
            labels: ks.Labels(service),
        },
        data: config
    })
}

// Add the ConfigMap function output to the manifest that is written
manifest.push(ConfigMap(service))
```

Your end result should be this:

```javascript
import * as param from '@jkcfg/std/param';
import * as api from '@jkcfg/kubernetes/api';
import * as std from '@jkcfg/std';
// Import the akp packages
import * as ks from '@jaxxstorm/jkcfg-example'; // This is my package name

// This reads the params file specified on the command line
const service = param.Object('service');
// Set the value of manifest (written to a file later) to the exported function
const manifest = ks.KubeServiceService(service);

// Read the params file for the config object
const config = param.Object('config');

// ConfigMaps are generally unique to each service
function ConfigMap(service) {
    return new api.core.v1.ConfigMap(service.name, {
        metadata: {
            namespace: service.namespace,
            labels: ks.Labels(service),
        },
        data: config
    })
}

// Add the ConfigMap function output to the manifest that is written
manifest.push(ConfigMap(service))

// Write the contents of manifest to a manifest file
std.write(manifest, `manifests/${service.name}.yaml`, { format: std.Format.YAMLStream });
```

This will now generate a ConfigMap, but it'll be empty. You need to add a `config` object to your params file. It'll end up looking like this:

```yaml
service:
  name: myapp # the name of your service
  namespace: myapp # the namespace you want to deploy to
  # deployment specific config
  deployment:
    annotations: # a key value mapping, below is an example
      # 'iam.amazonaws.com/role': 'kiam-role
    image: jaxxstorm/myapp
  ingress:
    class: 'default'
    host: 'myapp.example.com' # the url you want to access you app on
  ports:
    web: 8080
    health: 8081
  resources:
    requests:
      cpu: "500m"
      memory: "500Mi"
    limits:
      cpu: "2000m"
      memory: "2000Mi"
  environment: dev
  tier: standard # only used for some config options, added as a label
  region: us-west-2
config:
  FOO: bar # Environment variables you want in your configmap
```

And now we have a working deployment, with all the resources we might need to run a service.

## Benefits

You might be wondering at this point, this a lot of work! Why not just use a Helm chart? My personal thoughts about why I prefer this way are:

- Helm charts are rarely agnostic. This pattern can be repeated for a lot of deployments, and because it's JavaScript you can also just pick and choose the parts you need and overload some exported functions if needed
- Using Helm charts mean developers have to learn a new pattern, specifically Go templates. With this method, they can use a programming language which they will undoubtedly feel more familiar with

## Next steps

This concludes part 1 of my series. In part 2, I'll talk a little bit about using the CI pipeline to generate these configs and push them to a deploy repo (specifically with Gitlab-CI) and then talk a little bit about using Argo do deployments.

All the code from this post can be found in the [github repo](https://github.com/jaxxstorm/jkcfg-example) if you want to take a look!

Stay tuned for the next post!