# Cloud Run Client Libraries

Google Cloud client libraries provide an idiomatic way to manage Cloud Run
resources programmatically.

## Getting Started

Ensure you have the Google Cloud SDK installed and authenticated.
[Install Google Cloud SDK](https://cloud.google.com/sdk/docs/install)

### Python

- **Installation:**

  ```bash
  pip install --upgrade google-cloud-run
  ```

- **Usage Example:**

  ```python
  from google.cloud import run_v2
  client = run_v2.ServicesClient()
  request = run_v2.ListServicesRequest(
    parent="projects/my-project/locations/us-central1"
  )
  page_result = client.list_services(request=request)
  ```

- [Python Reference](https://docs.cloud.google.com/python/docs/reference/run/latest)

### Java

- **Maven Dependency:**

  ```xml
  <dependencyManagement>
  <dependencies>
   <dependency>
      <groupId>com.google.cloud</groupId>
      <artifactId>libraries-bom</artifactId>
      <version>26.79.0</version>
      <type>pom</type>
      <scope>import</scope>
   </dependency>
  </dependencies>
  </dependencyManagement>
  <dependency>
    <groupId>com.google.cloud</groupId>
    <artifactId>google-cloud-run</artifactId>
  </dependency>
  ```

- **Usage Example:**

  ```java
  try (ServicesClient servicesClient = ServicesClient.create()) {
    ListServicesRequest request = ListServicesRequest.newBuilder()
        .setParent(LocationName.of("my-project", "us-central1").toString())
        .build();
    for (Service element : servicesClient.listServices(request).iterateAll()) {
      System.out.println(element.getName());
    }
  }
  ```

- [Java Reference](https://docs.cloud.google.com/java/docs/reference/google-cloud-run/latest/overview)

### Node.js (TypeScript)

- **Installation:**

  ```bash
  npm install @google-cloud/run
  ```

- **Usage Example:**

  ```typescript
  import {ServicesClient} from '@google-cloud/run';
  const client = new ServicesClient();
  const [services] = await client.listServices({
    parent: 'projects/my-project/locations/us-central1',
  });
  ```

- [Node.js Reference](https://googleapis.dev/nodejs/run/latest/index.html)

### Go

- **Installation:**

  ```bash
  go get cloud.google.com/go/run/apiv2
  ```

- **Usage Example:**

  ```go
  package main

  import (
  	"context"
  	"fmt"
  	"log" // Import the log package

  	run "cloud.google.com/go/run/apiv2"
  	runpb "cloud.google.com/go/run/apiv2/runpb"
  	"google.golang.org/api/iterator"
  )

  func main() {
  	ctx := context.Background()
  	client, err := run.NewServicesClient(ctx)
  	if err != nil {
  		// Log the error and exit if the client can't be created
  		log.Fatalf("Failed to create Cloud Run Services client: %v", err)
  	}
  	defer client.Close()

  	req := &runpb.ListServicesRequest{
  		Parent: "projects/my-project/locations/us-central1", // Remember to replace my-project
  	}
  	it := client.ListServices(ctx, req)

  	fmt.Println("Cloud Run Services:")
  	for {
  		resp, err := it.Next()
  		if err == iterator.Done {
  			break // Finished iterating successfully
  		}
  		if err != nil {
  			// Log the error and exit if iteration fails
  			log.Fatalf("Error iterating services: %v", err)
  		}
  		fmt.Println(resp.GetName())
  	}
  }
  ```

- [Go Reference](https://docs.cloud.google.com/go/docs/reference/cloud.google.com/go/run/latest)

## Source Code Samples

For more examples across languages, visit the
[Cloud Run Code Samples](https://cloud.google.com/run/docs/samples).