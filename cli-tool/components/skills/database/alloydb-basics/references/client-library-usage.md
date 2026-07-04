# AlloyDB Client Libraries & Connectors

Google Cloud provides various ways to connect to AlloyDB idiomatically from
different programming languages. We optionally provide Client Libraries and
Connectors to facilitate secure authentication and connection from your clients
to your AlloyDB instances. These tools handle the management of SSL
certificates, firewall rules, and IAM Auth token automation.

## AlloyDB Language Connectors

Language connectors are libraries for Python, Java, and Go designed for
developers who prefer an integrated, driver-level experience over the
operational overhead of managing the Auth Proxy as a separate binary.

### Python

-   **Installation:**

  ```bash
  pip install "google-cloud-alloydb-connector[pg8000]" sqlalchemy
  ```

-   **Usage Example:**

  ```python
  import sqlalchemy
  from google.cloud.alloydbconnector import Connector

  INSTANCE_URI = "projects/MY_PROJECT/locations/MY_REGION/clusters/MY_CLUSTER/instances/MY_INSTANCE"

  with Connector() as connector:
      pool = sqlalchemy.create_engine(
          "postgresql+pg8000://",
          creator=lambda: connector.connect(
              INSTANCE_URI,
              "pg8000",
              user="my-user",
              password="my-password",
              db="my-db",
          ),
      )

      with pool.connect() as conn:
          result = conn.execute(sqlalchemy.text("SELECT NOW()")).fetchone()
          print(result)
  ```

### Java

-   **Maven Dependency:**

  ```xml
  <dependency>
    <groupId>com.google.cloud</groupId>
    <artifactId>alloydb-jdbc-connector</artifactId>
  </dependency>
  <dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
  </dependency>
  <dependency>
    <groupId>com.zaxxer</groupId>
    <artifactId>HikariCP</artifactId>
  </dependency>
  ```

-   **Configuring a Connection Pool:**

    We recommend using HikariCP for connection pooling. To use HikariCP with the
    Java Connector, you will need to set the usual properties (e.g., JDBC URL,
    username, password, etc) and you will need to set two Connector specific
    properties:

    *   `socketFactory` should be set to
        `com.google.cloud.alloydb.SocketFactory`
    *   `alloydbInstanceName` should be set to the AlloyDB instance you want to
    connect to, e.g.:
        `projects/<PROJECT>/locations/<REGION>/clusters/<CLUSTER>/instances/<INSTANCE>`

    Basic configuration of a data source looks like this:

  ```java
  import com.zaxxer.hikari.HikariConfig;
  import com.zaxxer.hikari.HikariDataSource;

  public class ExampleApplication {

    private HikariDataSource dataSource;

    public HikariDataSource getDataSource() {
      HikariConfig config = new HikariConfig();

      // There is no need to set a host on the JDBC URL
      // since the Connector will resolve the correct IP address.
      config.setJdbcUrl(String.format("jdbc:postgresql:///%s", System.getenv("ALLOYDB_DB")));
      config.setUsername(System.getenv("ALLOYDB_USER"));
      config.setPassword(System.getenv("ALLOYDB_PASS"));

      // Tell the driver to use the AlloyDB Java Connector's SocketFactory
      // when connecting to an instance/
      config.addDataSourceProperty("socketFactory",
          "com.google.cloud.alloydb.SocketFactory");
      // Tell the Java Connector which instance to connect to.
      config.addDataSourceProperty("alloydbInstanceName",
          System.getenv("ALLOYDB_INSTANCE_NAME"));

      dataSource = new HikariDataSource(config);
      return dataSource;
    }

    // Use DataSource as usual ...

  }
  ```

    See [end to end
        test](https://github.com/GoogleCloudPlatform/alloydb-java-connector/blob/main/jdbc/postgres/src/test/java/com/google/cloud/alloydb/postgres/PgJdbcIntegrationTests.java)
    for a full example.

    See [About Pool
        Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)
    for useful guidance on getting the best performance from a connection pool.

### Go

-   **Installation:**

  ```bash
  go get cloud.google.com/go/alloydbconn
  ```

-   **Usage Example:**

  ```go
  package main

  import (
      "database/sql"
      "fmt"
      "log"

      "cloud.google.com/go/alloydbconn/driver/pgxv5"
  )

  func main() {
      // Register the AlloyDB driver with the name "alloydb"
      // Uses Private IP by default. See Network Options below for details.
      cleanup, err := pgxv5.RegisterDriver("alloydb")
      if err != nil {
          log.Fatal(err)
      }
      defer cleanup()

      // Instance URI format:
      //   projects/PROJECT/locations/REGION/clusters/CLUSTER/instances/INSTANCE
      db, err := sql.Open("alloydb", fmt.Sprintf(
          "host=%s user=%s password=%s dbname=%s sslmode=disable",
          "projects/my-project/locations/us-central1/clusters/my-cluster/instances/my-instance",
          "my-user",
          "my-password",
          "my-db",
      ))
      if err != nil {
          log.Fatal(err)
      }
      defer db.Close()

      var greeting string
      if err := db.QueryRow("SELECT 'Hello, AlloyDB!'").Scan(&greeting); err != nil {
          log.Fatal(err)
      }
      fmt.Println(greeting)
  }
  ```

## Standard PostgreSQL Drivers

Since AlloyDB is PostgreSQL-compatible, you can also use standard drivers:

-   **Python:** `psycopg2`, `asyncpg`, `pg8000`

-   **Java:** `PostgreSQL JDBC Driver`

-   **Go:** `lib/pq`, `jackc/pgx`

For more details, see: [AlloyDB
Connectors](https://cloud.google.com/alloydb/docs/connect-external).