# Deployment Guide

Complete guide to deploying MLflow models to production environments.

## Table of Contents
- Deployment Options
- Local Serving
- REST API Serving
- Docker Deployment
- Cloud Deployment
- Batch Inference
- Production Patterns
- Monitoring

## Deployment Options

MLflow supports multiple deployment targets:

| Target | Use Case | Complexity |
|--------|----------|------------|
| **Local Server** | Development, testing | Low |
| **REST API** | Production serving | Medium |
| **Docker** | Containerized deployment | Medium |
| **AWS SageMaker** | Managed AWS deployment | High |
| **Azure ML** | Managed Azure deployment | High |
| **Kubernetes** | Scalable orchestration | High |
| **Batch** | Offline predictions | Low |

## Local Serving

### Serve Model Locally

```bash
# Serve registered model
mlflow models serve -m "models:/product-classifier/Production" -p 5001

# Serve from run
mlflow models serve -m "runs:/abc123/model" -p 5001

# Serve with custom host
mlflow models serve -m "models:/my-model/Production" -h 0.0.0.0 -p 8080

# Serve with workers (for scalability)
mlflow models serve -m "models:/my-model/Production" -p 5001 --workers 4
```

**Output:**
```
Serving model on http://127.0.0.1:5001
```

### Test Local Server

```bash
# Single prediction
curl http://127.0.0.1:5001/invocations \
  -H 'Content-Type: application/json' \
  -d '{
    "inputs": [[1.0, 2.0, 3.0, 4.0]]
  }'

# Batch predictions
curl http://127.0.0.1:5001/invocations \
  -H 'Content-Type: application/json' \
  -d '{
    "inputs": [
      [1.0, 2.0, 3.0, 4.0],
      [5.0, 6.0, 7.0, 8.0]
    ]
  }'

# CSV input
curl http://127.0.0.1:5001/invocations \
  -H 'Content-Type: text/csv' \
  --data-binary @data.csv
```

### Python Client

```python
import requests
import json

url = "http://127.0.0.1:5001/invocations"

data = {
    "inputs": [[1.0, 2.0, 3.0, 4.0]]
}

headers = {"Content-Type": "application/json"}

response = requests.post(url, json=data, headers=headers)
predictions = response.json()

print(predictions)
```

## REST API Serving

### Build Custom Serving API

```python
from flask import Flask, request, jsonify
import mlflow.pyfunc

app = Flask(__name__)

# Load model on startup
model = mlflow.pyfunc.load_model("models:/product-classifier/Production")

@app.route('/predict', methods=['POST'])
def predict():
    """Prediction endpoint."""
    data = request.get_json()
    inputs = data.get('inputs')

    # Make predictions
    predictions = model.predict(inputs)

    return jsonify({
        'predictions': predictions.tolist()
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
```

### FastAPI Serving

```python
from fastapi import FastAPI
from pydantic import BaseModel
import mlflow.pyfunc
import numpy as np

app = FastAPI()

# Load model
model = mlflow.pyfunc.load_model("models:/product-classifier/Production")

class PredictionRequest(BaseModel):
    inputs: list

class PredictionResponse(BaseModel):
    predictions: list

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Make predictions."""
    inputs = np.array(request.inputs)
    predictions = model.predict(inputs)

    return PredictionResponse(predictions=predictions.tolist())

@app.get("/health")
async def health():
    """Health check."""
    return {"status": "healthy"}

# Run with: uvicorn main:app --host 0.0.0.0 --port 5001
```

## Docker Deployment

### Build Docker Image

```bash
# Build Docker image with MLflow
mlflow models build-docker \
  -m "models:/product-classifier/Production" \
  -n product-classifier:v1

# Build with custom image name
mlflow models build-docker \
  -m "runs:/abc123/model" \
  -n my-registry/my-model:latest

# Build and enable MLServer (for KServe/Seldon)
mlflow models build-docker \
  -m "models:/my-model/Production" \
  -n my-model:v1 \
  --enable-mlserver
```

### Run Docker Container

```bash
# Run container
docker run -p 5001:8080 product-classifier:v1

# Run with environment variables
docker run \
  -p 5001:8080 \
  -e MLFLOW_TRACKING_URI=http://mlflow-server:5000 \
  product-classifier:v1

# Run with GPU support
docker run --gpus all -p 5001:8080 product-classifier:v1
```

### Test Docker Container

```bash
# Test endpoint
curl http://localhost:5001/invocations \
  -H 'Content-Type: application/json' \
  -d '{"inputs": [[1.0, 2.0, 3.0, 4.0]]}'
```

### Custom Dockerfile

```dockerfile
FROM python:3.9-slim

# Install MLflow
RUN pip install mlflow boto3

# Set working directory
WORKDIR /app

# Copy model (alternative to downloading from tracking server)
COPY model/ /app/model/

# Expose port
EXPOSE 8080

# Set environment variables
ENV MLFLOW_TRACKING_URI=http://mlflow-server:5000

# Serve model
CMD ["mlflow", "models", "serve", "-m", "/app/model", "-h", "0.0.0.0", "-p", "8080"]
```

## Cloud Deployment

### AWS SageMaker

#### Deploy to SageMaker

```bash
# Build and push Docker image to ECR
mlflow sagemaker build-and-push-container

# Deploy model to SageMaker endpoint
mlflow deployments create \
  -t sagemaker \
  -m "models:/product-classifier/Production" \
  --name product-classifier-endpoint \
  --region-name us-west-2 \
  --config instance_type=ml.m5.xlarge \
  --config instance_count=1
```

#### Python API

```python
import mlflow.sagemaker

# Deploy to SageMaker
mlflow.sagemaker.deploy(
    app_name="product-classifier",
    model_uri="models:/product-classifier/Production",
    region_name="us-west-2",
    mode="create",
    instance_type="ml.m5.xlarge",
    instance_count=1,
    vpc_config={
        "SecurityGroupIds": ["sg-123456"],
        "Subnets": ["subnet-123456", "subnet-789012"]
    }
)
```

#### Invoke SageMaker Endpoint

```python
import boto3
import json

runtime = boto3.client('sagemaker-runtime', region_name='us-west-2')

# Prepare input
data = {
    "inputs": [[1.0, 2.0, 3.0, 4.0]]
}

# Invoke endpoint
response = runtime.invoke_endpoint(
    EndpointName='product-classifier',
    ContentType='application/json',
    Body=json.dumps(data)
)

# Parse response
predictions = json.loads(response['Body'].read())
print(predictions)
```

#### Update SageMaker Endpoint

```bash
# Update endpoint with new model version
mlflow deployments update \
  -t sagemaker \
  -m "models:/product-classifier/Production" \
  --name product-classifier-endpoint
```

#### Delete SageMaker Endpoint

```bash
# Delete endpoint
mlflow deployments delete -t sagemaker --name product-classifier-endpoint
```

### Azure ML

#### Deploy to Azure

```bash
# Deploy to Azure ML
mlflow deployments create \
  -t azureml \
  -m "models:/product-classifier/Production" \
  --name product-classifier-azure \
  --config workspace_name=my-workspace \
  --config resource_group=my-resource-group
```

#### Python API

```python
import mlflow.azureml

# Deploy to Azure ML
mlflow.azureml.deploy(
    model_uri="models:/product-classifier/Production",
    workspace=workspace,
    deployment_config=deployment_config,
    service_name="product-classifier"
)
```

### Kubernetes (KServe)

#### Deploy to Kubernetes

```yaml
# kserve-inference.yaml
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: product-classifier
spec:
  predictor:
    mlflow:
      storageUri: "models:/product-classifier/Production"
      protocolVersion: v2
      runtimeVersion: 1.0.0
```

```bash
# Apply to cluster
kubectl apply -f kserve-inference.yaml

# Check status
kubectl get inferenceservice product-classifier

# Get endpoint URL
kubectl get inferenceservice product-classifier -o jsonpath='{.status.url}'
```

## Batch Inference

### Batch Prediction with Spark

```python
import mlflow.pyfunc
from pyspark.sql import SparkSession

# Load model as Spark UDF
model_uri = "models:/product-classifier/Production"
predict_udf = mlflow.pyfunc.spark_udf(spark, model_uri)

# Load data
df = spark.read.parquet("s3://bucket/data/")

# Apply predictions
predictions_df = df.withColumn(
    "prediction",
    predict_udf(*df.columns)
)

# Save results
predictions_df.write.parquet("s3://bucket/predictions/")
```

### Batch Prediction with Pandas

```python
import mlflow.pyfunc
import pandas as pd

# Load model
model = mlflow.pyfunc.load_model("models:/product-classifier/Production")

# Load data in batches
batch_size = 10000

for chunk in pd.read_csv("large_data.csv", chunksize=batch_size):
    # Make predictions
    predictions = model.predict(chunk)

    # Save results
    chunk['prediction'] = predictions
    chunk.to_csv("predictions.csv", mode='a', header=False, index=False)
```

### Scheduled Batch Job

```python
import mlflow.pyfunc
import pandas as pd
from datetime import datetime

def batch_predict():
    """Daily batch prediction job."""
    # Load model
    model = mlflow.pyfunc.load_model("models:/product-classifier/Production")

    # Load today's data
    today = datetime.now().strftime("%Y-%m-%d")
    df = pd.read_parquet(f"s3://bucket/data/{today}/")

    # Predict
    predictions = model.predict(df)

    # Save results
    df['prediction'] = predictions
    df['prediction_date'] = today
    df.to_parquet(f"s3://bucket/predictions/{today}/")

    print(f"✅ Batch prediction complete for {today}")

# Run with scheduler (e.g., Airflow, cron)
batch_predict()
```

## Production Patterns

### Blue-Green Deployment

```python
import mlflow.pyfunc

# Load both models
blue_model = mlflow.pyfunc.load_model("models:/product-classifier@blue")
green_model = mlflow.pyfunc.load_model("models:/product-classifier@green")

# Switch traffic (controlled by feature flag)
def get_model():
    if feature_flag.is_enabled("use_green_model"):
        return green_model
    else:
        return blue_model

# Serve predictions
def predict(inputs):
    model = get_model()
    return model.predict(inputs)
```

### Canary Deployment

```python
import random
import mlflow.pyfunc

# Load models
stable_model = mlflow.pyfunc.load_model("models:/product-classifier@stable")
canary_model = mlflow.pyfunc.load_model("models:/product-classifier@canary")

def predict_with_canary(inputs, canary_percentage=10):
    """Route traffic: 90% stable, 10% canary."""
    if random.random() * 100 < canary_percentage:
        model = canary_model
        version = "canary"
    else:
        model = stable_model
        version = "stable"

    predictions = model.predict(inputs)

    # Log which version was used
    log_prediction_metrics(version, predictions)

    return predictions
```

### Shadow Deployment

```python
import mlflow.pyfunc
import asyncio

# Load models
production_model = mlflow.pyfunc.load_model("models:/product-classifier@production")
shadow_model = mlflow.pyfunc.load_model("models:/product-classifier@shadow")

async def predict_with_shadow(inputs):
    """Run shadow model in parallel, return production results."""
    # Production prediction (synchronous)
    production_preds = production_model.predict(inputs)

    # Shadow prediction (async, don't block)
    asyncio.create_task(shadow_predict(inputs))

    return production_preds

async def shadow_predict(inputs):
    """Run shadow model and log results."""
    shadow_preds = shadow_model.predict(inputs)

    # Compare predictions
    log_shadow_comparison(shadow_preds)
```

### Model Fallback

```python
import mlflow.pyfunc

class FallbackModel:
    """Model with fallback on error."""

    def __init__(self, primary_uri, fallback_uri):
        self.primary = mlflow.pyfunc.load_model(primary_uri)
        self.fallback = mlflow.pyfunc.load_model(fallback_uri)

    def predict(self, inputs):
        try:
            return self.primary.predict(inputs)
        except Exception as e:
            print(f"Primary model failed: {e}, using fallback")
            return self.fallback.predict(inputs)

# Use it
model = FallbackModel(
    primary_uri="models:/product-classifier@latest",
    fallback_uri="models:/product-classifier@stable"
)

predictions = model.predict(inputs)
```

## Monitoring

### Log Predictions

```python
import mlflow

def predict_and_log(model, inputs):
    """Make predictions and log to MLflow."""
    with mlflow.start_run(run_name="inference"):
        # Predict
        predictions = model.predict(inputs)

        # Log inputs
        mlflow.log_param("num_inputs", len(inputs))

        # Log predictions
        mlflow.log_metric("avg_prediction", predictions.mean())
        mlflow.log_metric("max_prediction", predictions.max())
        mlflow.log_metric("min_prediction", predictions.min())

        # Log timestamp
        import time
        mlflow.log_param("timestamp", time.time())

    return predictions
```

### Model Performance Monitoring

```python
import mlflow
from sklearn.metrics import accuracy_score

def monitor_model_performance(model, X_test, y_test):
    """Monitor production model performance."""
    with mlflow.start_run(run_name="production-monitoring"):
        # Predict
        predictions = model.predict(X_test)

        # Calculate metrics
        accuracy = accuracy_score(y_test, predictions)

        # Log metrics
        mlflow.log_metric("production_accuracy", accuracy)
        mlflow.log_param("test_samples", len(X_test))

        # Alert if performance drops
        if accuracy < 0.85:
            print(f"⚠️  Alert: Production accuracy dropped to {accuracy}")
            # Send alert (e.g., Slack, PagerDuty)

# Run periodically (e.g., daily)
monitor_model_performance(model, X_test, y_test)
```

### Request Logging

```python
from flask import Flask, request, jsonify
import mlflow.pyfunc
import time

app = Flask(__name__)
model = mlflow.pyfunc.load_model("models:/product-classifier/Production")

@app.route('/predict', methods=['POST'])
def predict():
    start_time = time.time()

    data = request.get_json()
    inputs = data.get('inputs')

    # Predict
    predictions = model.predict(inputs)

    # Calculate latency
    latency = (time.time() - start_time) * 1000  # ms

    # Log request
    with mlflow.start_run(run_name="inference"):
        mlflow.log_metric("latency_ms", latency)
        mlflow.log_param("num_inputs", len(inputs))

    return jsonify({
        'predictions': predictions.tolist(),
        'latency_ms': latency
    })
```

## Best Practices

### 1. Use Model Registry URIs

```python
# ✅ Good: Load from registry
model = mlflow.pyfunc.load_model("models:/product-classifier/Production")

# ❌ Bad: Hard-code run IDs
model = mlflow.pyfunc.load_model("runs:/abc123/model")
```

### 2. Implement Health Checks

```python
@app.route('/health', methods=['GET'])
def health():
    """Comprehensive health check."""
    try:
        # Check model loaded
        if model is None:
            return jsonify({'status': 'unhealthy', 'reason': 'model not loaded'}), 503

        # Check model can predict
        test_input = [[1.0, 2.0, 3.0, 4.0]]
        _ = model.predict(test_input)

        return jsonify({'status': 'healthy'}), 200

    except Exception as e:
        return jsonify({'status': 'unhealthy', 'reason': str(e)}), 503
```

### 3. Version Your Deployment

```python
# Tag Docker images with model version
mlflow models build-docker \
  -m "models:/product-classifier/Production" \
  -n product-classifier:v5

# Track deployment version
client.set_model_version_tag(
    name="product-classifier",
    version="5",
    key="deployed_as",
    value="product-classifier:v5"
)
```

### 4. Use Environment Variables

```python
import os
import mlflow.pyfunc

# Configuration via environment
TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
MODEL_NAME = os.getenv("MODEL_NAME", "product-classifier")
MODEL_STAGE = os.getenv("MODEL_STAGE", "Production")

mlflow.set_tracking_uri(TRACKING_URI)

# Load model
model_uri = f"models:/{MODEL_NAME}/{MODEL_STAGE}"
model = mlflow.pyfunc.load_model(model_uri)
```

### 5. Implement Graceful Shutdown

```python
import signal
import sys

def signal_handler(sig, frame):
    """Handle shutdown gracefully."""
    print("Shutting down gracefully...")

    # Close connections
    # Save state
    # Finish pending requests

    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)
```

## Resources

- **MLflow Deployment**: https://mlflow.org/docs/latest/deployment/
- **SageMaker Integration**: https://mlflow.org/docs/latest/python_api/mlflow.sagemaker.html
- **Azure ML Integration**: https://mlflow.org/docs/latest/python_api/mlflow.azureml.html
- **KServe Integration**: https://kserve.github.io/website/latest/modelserving/v1beta1/mlflow/v2/
