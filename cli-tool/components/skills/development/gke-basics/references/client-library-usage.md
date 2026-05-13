# GKE Client Libraries

To interact with the GKE (Kubernetes) API programmatically, use the official
Kubernetes client libraries.

**Prerequisite:** These libraries interact with the Kubernetes API. You
must already have a running GKE cluster and valid credentials
(for example, by running `gcloud container clusters get-credentials`)
before running this code.

## Getting Started

Kubernetes client libraries allow you to manage clusters and workloads from
within your application code.

### Python

- **Installation:**

  ```bash
  pip install kubernetes
  ```

- **Usage Example:**

  ```python
  from kubernetes import client, config
  config.load_kube_config() # Loads from ~/.kube/config
  v1 = client.CoreV1Api()
  print("Listing pods with their IPs:")
  ret = v1.list_pod_for_all_namespaces(watch=False)
  for i in ret.items:
      print("%s\t%s\t%s" % (i.status.pod_ip, i.metadata.namespace, i.metadata.name))
  ```

### Go

- **Installation:**

  ```bash
  go get k8s.io/client-go@latest
  ```

- **Usage Example:**

  ```go
  import (
      "k8s.io/client-go/kubernetes"
      "k8s.io/client-go/tools/clientcmd"
  )
  config, _ := clientcmd.BuildConfigFromFlags("", kubeconfig)
  clientset, _ := kubernetes.NewForConfig(config)
  pods, _ := clientset.CoreV1().Pods("").List(
      context.TODO, metav1.ListOptions{})
  ```

### Node.js (TypeScript)

- **Installation:**

  ```bash
  npm install @kubernetes/client-node
  ```

- **Usage Example:**

  ```javascript
  const k8s = require('@kubernetes/client-node');

  const kc = new k8s.KubeConfig();
  kc.loadFromDefault(); // Automatically detects local vs. in-cluster configuration

  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

  // In most recent library versions, parameters must be passed inside an object
  k8sApi.listNamespacedPod({ namespace: 'default' }).then((res) => {
      const pods = res.items || res.body.items;
      console.log(`Found ${pods.length} pods in 'default' namespace.`);
  });
  ```

### Java

- [Java Reference](https://github.com/kubernetes-client/java)

## GKE-specific API (Container Service)

To manage the GKE *service* itself (e.g., create/delete clusters)
programmatically, use the Google Cloud Container client libraries.

- [Google Cloud Container Client Libraries](https://cloud.google.com/kubernetes-engine/docs/reference/libraries)
