# Cloud SQL Client Libraries

Google Cloud provides client libraries and connectors to simplify connecting to
Cloud SQL from various programming languages.

## Getting Started

Ensure you have the latest version of the Google Cloud SDK installed and
authenticated.
[Install Google Cloud SDK](https://cloud.google.com/sdk/docs/install)

### Language Connectors

The Cloud SQL Language Connectors (Python, Java, Go, Node.js) provide a secure
way to connect to the Cloud SQL instance without managing IP allowlists or SSL
certificates.

#### Python

-   **Installation for a Cloud SQL for PostgreSQL instance:**

    ```bash
    pip install "cloud-sql-python-connector[pg8000]"
    ```

-   **Usage Example:**

    ```python
    from google.cloud.sql.connector import Connector
    connector = Connector()
    def getconn():
      conn = connector.connect(
          "project:region:instance",
          "pg8000",
          user="my-user",
          password="my-password",
          db="my-db"
      )
      return conn
    ```

#### Java

-   **Maven Dependencies:**

    The recommended method is to use the Cloud SQL JDBC Socket Factory. Add the
    BOM to your `<dependencyManagement>` section:

    ```xml
    <dependencyManagement>
      <dependencies>
        <dependency>
          <groupId>com.google.cloud.sql</groupId>
          <artifactId>jdbc-socket-factory-bom</artifactId>
          <version>1.18.0</version>
          <type>pom</type>
          <scope>import</scope>
        </dependency>
      </dependencies>
    </dependencyManagement>
    ```

    Then add dependencies for your database:

    *   **PostgreSQL:**
        ```xml  
        <dependencies>
          <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <version>42.7.3</version>
          </dependency>
          <dependency>
            <groupId>com.google.cloud.sql</groupId>
            <artifactId>postgres-socket-factory</artifactId>
          </dependency>
        </dependencies>
        ```

    *   **MySQL:**
        ```xml 
        <dependencies>
          <dependency>
            <groupId>com.mysql</groupId>
            <artifactId>mysql-connector-j</artifactId>
            <version>8.0.33</version>
          </dependency>
          <dependency>
            <groupId>com.google.cloud.sql</groupId>
            <artifactId>mysql-socket-factory-connector-j-8</artifactId>
          </dependency>
        </dependencies>
        ```

#### Node.js (TypeScript)

-   **Installation:**

    ```bash
    npm install @google-cloud/cloud-sql-connector
    ```

#### Go

-   **Installation:**

    ```bash
    go get cloud.google.com/go/cloudsqlconn
    ```

## Cloud SQL Admin API

To manage Cloud SQL resources (e.g., list instances) programmatically, use the
`sqladmin` libraries.

-   [Cloud SQL Admin API Overview](https://docs.cloud.google.com/sql/docs/mysql/admin-api)
