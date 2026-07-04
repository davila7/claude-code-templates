# BigQuery Core Concepts

BigQuery is a fully managed, AI-ready data platform that helps you manage and
analyze your data with built-in features like machine learning, search,
geospatial analysis, and business intelligence. BigQuery's serverless
architecture lets you use languages like SQL and Python to answer your
organization's biggest questions with zero infrastructure management.

BigQuery provides a uniform way to work with both structured and unstructured
data and supports open table formats like Apache Iceberg. BigQuery streaming
supports continuous data ingestion and analysis while BigQuery's scalable,
distributed analysis engine lets you query terabytes in seconds and petabytes in
minutes.

## Architecture

BigQuery's architecture separates compute and storage, connected by a
petabit-scale network.

-   **BigQuery Storage:** A columnar storage format optimized for analytical
    queries. It can be replicated across multiple locations for high
    availability.

-   **BigQuery Analytics:** A scalable, distributed analysis engine that can
    process data in BigQuery and in external sources.

## Resource Hierarchy

BigQuery organizes resources in a structured hierarchy:

1.  **Organization/Folder/Project:** Standard Google Cloud resource containers.
2.  **Dataset:** The top-level container for tables and views.
3.  **Table/View:** The basic unit of data storage and logical representation.

## Analytics Workflows

-   **Ad Hoc Analysis:** Using GoogleSQL for interactive queries.

-   **Geospatial Analysis:** Analyzing and visualizing spatial data using
    geography types.

-   **Machine Learning (BigQuery ML):** Creating and executing ML models
    directly in BigQuery using SQL.

-   **Gemini in BigQuery:** AI-powered assistance for data preparation, SQL
    generation, and visualization. Refer to the [Gemini
    Models](https://ai.google.dev/gemini-api/docs/models) for more information.

-   **Stream Processing (BigQuery continuous queries):** Long running SQL
    statements that analyze and transform incoming data in near real time as it
    arrives in BigQuery. This feature enables unbounded streaming pipelines for
    real-time AI inference (using Vertex AI) and Reverse ETL to downstream
    systems. Results can be exported to Pub/Sub, Bigtable, Spanner, or other
    BigQuery tables. Note that running continuous queries requires a BigQuery
    reservation with a `CONTINUOUS` assignment type.

## BigQuery Studio

A unified workspace for data engineering, analysis, and predictive modeling.

-   **SQL Editor:** With code completion and generation.

-   **Python Notebooks:** Built-in support for Colab Enterprise and BigQuery
    DataFrames (BigFrames).

-   **Data Discovery:** Integrated with Dataplex for search and profiling.

## Pricing

BigQuery pricing consists of two main components: compute (analysis) costs and
storage costs.

-   **Storage:** Storage costs are based on the amount of data stored in
    BigQuery tables. Storage is classified as either active storage (any table
    or partition modified in the last 90 days) and long-term storage (data that
    hasn't been modified for 90 consecutive days, resulting in a price drop of
    approximately 50%).

-   **Analysis:** Billed based on bytes processed (On-demand) or dedicated slots
    (Capacity/Reservations).

For the latest pricing details, visit: [BigQuery
Pricing](https://cloud.google.com/bigquery/pricing).
