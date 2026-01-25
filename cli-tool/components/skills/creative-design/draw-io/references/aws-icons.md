# AWS アイコンとサービス名

## 1. 正しいサービス名の規則

| 接頭辞 | 例 |
|--------|-----|
| Amazon | Amazon ECS, Amazon ECR, Amazon S3, Amazon RDS, Amazon CloudWatch |
| AWS | AWS Lambda, AWS IAM, AWS CloudFormation, AWS Step Functions |
| Elastic | Elastic Load Balancing |

- 略称のみの使用は避ける (ECS → Amazon ECS)
- 正式名称を使用する

## 2. アイコンスタイル

### 2.1. リソースアイコン (基本形式)

```xml
shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.{service_name};
```

### 2.2. プロダクトアイコン

```xml
shape=mxgraph.aws4.productIcon;prIcon=mxgraph.aws4.{service_name};
```

### 2.3. 注意事項

- `mxgraph.aws4.*` を使用 (aws3 は古いため非推奨)
- サービス名は snake_case で指定

## 3. カテゴリ別アイコン

### 3.1. Compute (コンピューティング)

| サービス | resIcon |
|----------|---------|
| Amazon EC2 | mxgraph.aws4.ec2 |
| EC2 Instance | mxgraph.aws4.instance2 |
| EC2 Instances | mxgraph.aws4.instances |
| Instance with CloudWatch | mxgraph.aws4.instance_with_cloudwatch2 |
| Spot Instance | mxgraph.aws4.spot_instance |
| Optimized Instance | mxgraph.aws4.optimized_instance |
| DB on Instance | mxgraph.aws4.db_on_instance |
| Elastic IP Address | mxgraph.aws4.elastic_ip_address |
| Rescue | mxgraph.aws4.rescue |
| Auto Scaling | mxgraph.aws4.auto_scaling2 |
| AWS Lambda | mxgraph.aws4.lambda |
| Lambda Function | mxgraph.aws4.lambda_function |
| Amazon Lightsail | mxgraph.aws4.lightsail |
| AWS Batch | mxgraph.aws4.batch |
| AWS Elastic Beanstalk | mxgraph.aws4.elastic_beanstalk |
| Elastic Beanstalk Application | mxgraph.aws4.application |
| Elastic Beanstalk Deployment | mxgraph.aws4.deployment |
| AWS Outposts | mxgraph.aws4.outposts |
| AWS App Runner | mxgraph.aws4.app_runner |
| AWS ParallelCluster | mxgraph.aws4.parallel_cluster |
| AWS Wavelength | mxgraph.aws4.wavelength |
| AWS Local Zones | mxgraph.aws4.local_zones |
| VMware Cloud on AWS | mxgraph.aws4.vmware_cloud_on_aws |
| Bottlerocket | mxgraph.aws4.bottlerocket |
| EC2 Image Builder | mxgraph.aws4.ec2_image_builder |
| Elastic Fabric Adapter | mxgraph.aws4.elastic_fabric_adapter |
| NICE DCV | mxgraph.aws4.nice_dcv |

### 3.2. Containers (コンテナ)

| サービス | resIcon |
|----------|---------|
| Amazon ECS | mxgraph.aws4.ecs |
| ECS Task | mxgraph.aws4.ecs_task |
| Amazon EKS | mxgraph.aws4.eks |
| EKS Cloud | mxgraph.aws4.eks_cloud |
| EKS Anywhere | mxgraph.aws4.eks_anywhere |
| Amazon ECR | mxgraph.aws4.ecr |
| AWS Fargate | mxgraph.aws4.fargate |
| Container 1 | mxgraph.aws4.container_1 |
| Container 2 | mxgraph.aws4.container_2 |
| Container 3 | mxgraph.aws4.container_3 |
| AWS App2Container | mxgraph.aws4.app2container |
| Red Hat OpenShift on AWS | mxgraph.aws4.red_hat_openshift |

### 3.3. Storage (ストレージ)

| サービス | resIcon |
|----------|---------|
| Amazon S3 | mxgraph.aws4.s3 |
| S3 Bucket | mxgraph.aws4.bucket |
| S3 Bucket with Objects | mxgraph.aws4.bucket_with_objects |
| S3 Object | mxgraph.aws4.object |
| S3 Glacier | mxgraph.aws4.glacier |
| S3 Glacier Archive | mxgraph.aws4.archive |
| S3 Glacier Vault | mxgraph.aws4.vault |
| Amazon EBS | mxgraph.aws4.ebs |
| EBS Volume | mxgraph.aws4.volume |
| EBS Snapshot | mxgraph.aws4.snapshot |
| Amazon EFS | mxgraph.aws4.efs |
| EFS File System | mxgraph.aws4.file_system |
| Amazon FSx | mxgraph.aws4.fsx |
| FSx for Lustre | mxgraph.aws4.fsx_for_lustre |
| FSx for Windows File Server | mxgraph.aws4.fsx_for_windows_file_server |
| FSx for NetApp ONTAP | mxgraph.aws4.fsx_for_netapp_ontap |
| FSx for OpenZFS | mxgraph.aws4.fsx_for_openzfs |
| AWS Storage Gateway | mxgraph.aws4.storage_gateway |
| File Gateway | mxgraph.aws4.file_gateway |
| Volume Gateway | mxgraph.aws4.volume_gateway |
| Tape Gateway | mxgraph.aws4.tape_gateway |
| AWS Backup | mxgraph.aws4.backup |
| AWS Elastic Disaster Recovery | mxgraph.aws4.elastic_disaster_recovery |
| AWS Snow Family | mxgraph.aws4.snow_family |

### 3.4. Database (データベース)

| サービス | resIcon |
|----------|---------|
| Amazon RDS | mxgraph.aws4.rds |
| RDS DB Instance | mxgraph.aws4.db_instance |
| RDS Read Replica | mxgraph.aws4.db_instance_read_replica |
| RDS Standby | mxgraph.aws4.db_instance_standby |
| RDS MySQL | mxgraph.aws4.mysql_db_instance |
| RDS MySQL (Alt) | mxgraph.aws4.mysql_db_instance_alternate |
| RDS PostgreSQL | mxgraph.aws4.postgresql_instance |
| RDS Oracle | mxgraph.aws4.oracle_db_instance |
| RDS Oracle (Alt) | mxgraph.aws4.oracle_db_instance_alternate |
| RDS SQL Server | mxgraph.aws4.ms_sql_instance |
| RDS SQL Server (Alt) | mxgraph.aws4.ms_sql_instance_alternate |
| RDS MariaDB | mxgraph.aws4.mariadb_instance |
| RDS SQL Primary | mxgraph.aws4.sql_primary |
| RDS SQL Replica | mxgraph.aws4.sql_replica |
| RDS PIOP | mxgraph.aws4.piop |
| Amazon Aurora | mxgraph.aws4.aurora |
| Aurora MySQL | mxgraph.aws4.aurora_mysql_instance |
| Aurora PostgreSQL | mxgraph.aws4.aurora_postgresql_instance |
| Amazon DynamoDB | mxgraph.aws4.dynamodb |
| DynamoDB Table | mxgraph.aws4.table |
| DynamoDB Item | mxgraph.aws4.item |
| DynamoDB Items | mxgraph.aws4.items |
| DynamoDB Attribute | mxgraph.aws4.attribute |
| DynamoDB Attributes | mxgraph.aws4.attributes |
| DynamoDB Global Secondary Index | mxgraph.aws4.global_secondary_index |
| Amazon ElastiCache | mxgraph.aws4.elasticache |
| ElastiCache for Redis | mxgraph.aws4.elasticache_for_redis |
| ElastiCache for Memcached | mxgraph.aws4.elasticache_for_memcached |
| ElastiCache Cache Node | mxgraph.aws4.cache_node |
| Amazon Redshift | mxgraph.aws4.redshift |
| Redshift Dense Compute Node | mxgraph.aws4.dense_compute_node |
| Redshift Dense Storage Node | mxgraph.aws4.dense_storage_node |
| Amazon Neptune | mxgraph.aws4.neptune |
| Amazon DocumentDB | mxgraph.aws4.documentdb |
| Amazon Timestream | mxgraph.aws4.timestream |
| Amazon MemoryDB | mxgraph.aws4.memorydb |
| Amazon Keyspaces | mxgraph.aws4.keyspaces |
| Amazon QLDB | mxgraph.aws4.qldb |
| Generic Database | mxgraph.aws4.database |

### 3.5. Networking (ネットワーク)

| サービス | resIcon |
|----------|---------|
| Amazon VPC | mxgraph.aws4.vpc |
| Internet Gateway | mxgraph.aws4.internet_gateway |
| NAT Gateway | mxgraph.aws4.nat_gateway |
| VPN Gateway | mxgraph.aws4.vpn_gateway |
| Customer Gateway | mxgraph.aws4.customer_gateway |
| VPN Connection | mxgraph.aws4.vpn_connection |
| VPC Peering | mxgraph.aws4.peering |
| VPC Endpoints | mxgraph.aws4.endpoints |
| VPC Flow Logs | mxgraph.aws4.flow_logs |
| Network ACL | mxgraph.aws4.network_access_control_list |
| Router | mxgraph.aws4.router |
| Elastic Network Interface | mxgraph.aws4.elastic_network_interface |
| Elastic Network Adapter | mxgraph.aws4.elastic_network_adapter |
| Amazon CloudFront | mxgraph.aws4.cloudfront |
| CloudFront Edge Location | mxgraph.aws4.edge_location |
| CloudFront Download Distribution | mxgraph.aws4.download_distribution |
| CloudFront Streaming Distribution | mxgraph.aws4.streaming_distribution |
| Amazon Route 53 | mxgraph.aws4.route_53 |
| Route 53 Hosted Zone | mxgraph.aws4.hosted_zone |
| Route 53 Route Table | mxgraph.aws4.route_table |
| Elastic Load Balancing | mxgraph.aws4.elastic_load_balancing |
| Application Load Balancer | mxgraph.aws4.application_load_balancer |
| Network Load Balancer | mxgraph.aws4.network_load_balancer |
| Gateway Load Balancer | mxgraph.aws4.gateway_load_balancer |
| Classic Load Balancer | mxgraph.aws4.classic_load_balancer |
| ELB (旧) | mxgraph.aws4.elb |
| Amazon API Gateway | mxgraph.aws4.api_gateway |
| API Gateway Endpoint | mxgraph.aws4.endpoint |
| AWS Direct Connect | mxgraph.aws4.direct_connect |
| AWS Transit Gateway | mxgraph.aws4.transit_gateway |
| Transit Gateway Attachment | mxgraph.aws4.transit_gateway_attachment |
| AWS PrivateLink | mxgraph.aws4.privatelink |
| AWS Global Accelerator | mxgraph.aws4.global_accelerator |
| AWS App Mesh | mxgraph.aws4.app_mesh |
| AWS Cloud Map | mxgraph.aws4.cloud_map |
| AWS Client VPN | mxgraph.aws4.client_vpn |
| AWS Site-to-Site VPN | mxgraph.aws4.site_to_site_vpn |
| AWS Network Firewall | mxgraph.aws4.network_firewall |
| Amazon VPC Lattice | mxgraph.aws4.vpc_lattice |
| Verified Access | mxgraph.aws4.verified_access |

### 3.6. Security, Identity & Compliance (セキュリティ)

| サービス | resIcon |
|----------|---------|
| AWS IAM | mxgraph.aws4.identity_and_access_management |
| IAM (短縮) | mxgraph.aws4.iam |
| IAM Role | mxgraph.aws4.role |
| IAM Permissions | mxgraph.aws4.permissions |
| IAM Identity Center | mxgraph.aws4.iam_identity_center |
| Amazon Cognito | mxgraph.aws4.cognito |
| AWS WAF | mxgraph.aws4.waf |
| AWS Shield | mxgraph.aws4.shield |
| AWS KMS | mxgraph.aws4.key_management_service |
| AWS Secrets Manager | mxgraph.aws4.secrets_manager |
| AWS Certificate Manager | mxgraph.aws4.certificate_manager |
| Amazon GuardDuty | mxgraph.aws4.guardduty |
| Amazon Inspector | mxgraph.aws4.inspector |
| Amazon Macie | mxgraph.aws4.macie |
| AWS Security Hub | mxgraph.aws4.security_hub |
| AWS Directory Service | mxgraph.aws4.directory_service |
| AWS Firewall Manager | mxgraph.aws4.firewall_manager |
| AWS Organizations | mxgraph.aws4.organizations |
| AWS Resource Access Manager | mxgraph.aws4.resource_access_manager |
| AWS Artifact | mxgraph.aws4.artifact |
| AWS Audit Manager | mxgraph.aws4.audit_manager |
| AWS CloudHSM | mxgraph.aws4.cloudhsm |
| Amazon Detective | mxgraph.aws4.detective |
| AWS Network Firewall | mxgraph.aws4.network_firewall |
| AWS Private CA | mxgraph.aws4.private_ca |
| AWS Security Lake | mxgraph.aws4.security_lake |
| AWS Signer | mxgraph.aws4.signer |
| Amazon Verified Permissions | mxgraph.aws4.verified_permissions |
| SAML Token | mxgraph.aws4.saml_token |

### 3.7. Analytics (分析)

| サービス | resIcon |
|----------|---------|
| Amazon Athena | mxgraph.aws4.athena |
| Amazon CloudSearch | mxgraph.aws4.cloudsearch |
| CloudSearch Search Documents | mxgraph.aws4.search_documents |
| AWS Glue | mxgraph.aws4.glue |
| AWS Glue DataBrew | mxgraph.aws4.glue_databrew |
| AWS Glue Elastic Views | mxgraph.aws4.glue_elastic_views |
| AWS Glue Data Catalog | mxgraph.aws4.data_catalog |
| AWS Glue Crawler | mxgraph.aws4.crawler |
| Amazon Kinesis | mxgraph.aws4.kinesis |
| Kinesis Data Streams | mxgraph.aws4.kinesis_data_streams |
| Kinesis Data Firehose | mxgraph.aws4.kinesis_data_firehose |
| Kinesis Data Analytics | mxgraph.aws4.kinesis_data_analytics |
| Kinesis Video Streams | mxgraph.aws4.kinesis_video_streams |
| Amazon EMR | mxgraph.aws4.emr |
| EMR Engine | mxgraph.aws4.emr_engine |
| EMR Engine MapR M3 | mxgraph.aws4.emr_engine_mapr_m3 |
| EMR Engine MapR M5 | mxgraph.aws4.emr_engine_mapr_m5 |
| EMR Engine MapR M7 | mxgraph.aws4.emr_engine_mapr_m7 |
| EMR HDFS Cluster | mxgraph.aws4.hdfs_cluster |
| EMR Cluster | mxgraph.aws4.cluster |
| Amazon OpenSearch | mxgraph.aws4.opensearch |
| Elasticsearch (旧) | mxgraph.aws4.elasticsearch_service |
| Amazon QuickSight | mxgraph.aws4.quicksight |
| AWS Data Pipeline | mxgraph.aws4.data_pipeline |
| Amazon MSK | mxgraph.aws4.msk |
| AWS Lake Formation | mxgraph.aws4.lake_formation |
| AWS Data Exchange | mxgraph.aws4.data_exchange |
| Amazon DataZone | mxgraph.aws4.datazone |
| AWS Clean Rooms | mxgraph.aws4.clean_rooms |
| AWS Entity Resolution | mxgraph.aws4.entity_resolution |
| Amazon FinSpace | mxgraph.aws4.finspace |
| Amazon Managed Grafana | mxgraph.aws4.managed_grafana |
| Amazon Managed Prometheus | mxgraph.aws4.managed_prometheus |

### 3.8. Machine Learning & AI (機械学習・AI)

| サービス | resIcon |
|----------|---------|
| Amazon SageMaker | mxgraph.aws4.sagemaker |
| SageMaker Notebook | mxgraph.aws4.sagemaker_notebook |
| SageMaker Model | mxgraph.aws4.sagemaker_model |
| SageMaker Ground Truth | mxgraph.aws4.sagemaker_ground_truth |
| Amazon Bedrock | mxgraph.aws4.bedrock |
| Amazon Q | mxgraph.aws4.amazon_q |
| Amazon Q Business | mxgraph.aws4.q_business |
| Amazon Q Developer | mxgraph.aws4.q_developer |
| Amazon Lex | mxgraph.aws4.lex |
| Amazon Polly | mxgraph.aws4.polly |
| Amazon Rekognition | mxgraph.aws4.rekognition |
| Amazon Transcribe | mxgraph.aws4.transcribe |
| Amazon Comprehend | mxgraph.aws4.comprehend |
| Amazon Textract | mxgraph.aws4.textract |
| Amazon Translate | mxgraph.aws4.translate |
| Amazon Personalize | mxgraph.aws4.personalize |
| Amazon Forecast | mxgraph.aws4.forecast |
| Amazon Kendra | mxgraph.aws4.kendra |
| Amazon CodeWhisperer | mxgraph.aws4.codewhisperer |
| Amazon CodeGuru | mxgraph.aws4.codeguru |
| CodeGuru Reviewer | mxgraph.aws4.codeguru_reviewer |
| CodeGuru Profiler | mxgraph.aws4.codeguru_profiler |
| Amazon Lookout | mxgraph.aws4.lookout |
| Lookout for Vision | mxgraph.aws4.lookout_for_vision |
| Lookout for Equipment | mxgraph.aws4.lookout_for_equipment |
| Lookout for Metrics | mxgraph.aws4.lookout_for_metrics |
| Amazon Fraud Detector | mxgraph.aws4.fraud_detector |
| AWS DeepRacer | mxgraph.aws4.deepracer |
| AWS DeepLens | mxgraph.aws4.deeplens |
| AWS DeepComposer | mxgraph.aws4.deepcomposer |
| AWS Panorama | mxgraph.aws4.panorama |
| Amazon Augmented AI | mxgraph.aws4.augmented_ai |
| Amazon HealthLake | mxgraph.aws4.healthlake |
| Amazon Monitron | mxgraph.aws4.monitron |
| Amazon Omics | mxgraph.aws4.omics |
| Apache MXNet on AWS | mxgraph.aws4.apache_mxnet |
| TensorFlow on AWS | mxgraph.aws4.tensorflow |
| PyTorch on AWS | mxgraph.aws4.pytorch |
| Deep Learning AMIs | mxgraph.aws4.deep_learning_amis |
| Deep Learning Containers | mxgraph.aws4.deep_learning_containers |
| Machine Learning (汎用) | mxgraph.aws4.machine_learning |

### 3.9. Application Integration (アプリケーション統合)

| サービス | resIcon |
|----------|---------|
| Amazon SNS | mxgraph.aws4.sns |
| SNS Topic | mxgraph.aws4.topic |
| SNS Email Notification | mxgraph.aws4.email_notification |
| SNS HTTP Notification | mxgraph.aws4.http_notification |
| Amazon SQS | mxgraph.aws4.sqs |
| SQS Queue | mxgraph.aws4.queue |
| SQS Message | mxgraph.aws4.message |
| Amazon EventBridge | mxgraph.aws4.eventbridge |
| EventBridge Event Bus | mxgraph.aws4.event_bus |
| EventBridge Rule | mxgraph.aws4.rule |
| EventBridge Schema Registry | mxgraph.aws4.schema_registry |
| EventBridge Pipes | mxgraph.aws4.eventbridge_pipes |
| EventBridge Scheduler | mxgraph.aws4.eventbridge_scheduler |
| AWS Step Functions | mxgraph.aws4.step_functions |
| Step Functions Workflow | mxgraph.aws4.workflow |
| Amazon AppFlow | mxgraph.aws4.appflow |
| Amazon MQ | mxgraph.aws4.mq |
| AWS AppSync | mxgraph.aws4.appsync |
| AWS Express Workflows | mxgraph.aws4.express_workflows |
| Amazon Managed Workflows for Apache Airflow | mxgraph.aws4.managed_workflows_apache_airflow |

### 3.10. Management & Governance (管理・ガバナンス)

| サービス | resIcon |
|----------|---------|
| Amazon CloudWatch | mxgraph.aws4.cloudwatch |
| CloudWatch (v2) | mxgraph.aws4.cloudwatch_2 |
| CloudWatch Alarm | mxgraph.aws4.alarm |
| CloudWatch Rule | mxgraph.aws4.event |
| CloudWatch Logs | mxgraph.aws4.logs |
| CloudWatch Metrics | mxgraph.aws4.metrics |
| AWS CloudFormation | mxgraph.aws4.cloudformation |
| CloudFormation Template | mxgraph.aws4.template |
| CloudFormation Stack | mxgraph.aws4.stack |
| CloudFormation Change Set | mxgraph.aws4.change_set |
| AWS CloudTrail | mxgraph.aws4.cloudtrail |
| AWS Systems Manager | mxgraph.aws4.systems_manager |
| Systems Manager Automation | mxgraph.aws4.automation |
| Systems Manager Inventory | mxgraph.aws4.inventory |
| Systems Manager Patch Manager | mxgraph.aws4.patch_manager |
| Systems Manager Run Command | mxgraph.aws4.run_command |
| Systems Manager State Manager | mxgraph.aws4.state_manager |
| Systems Manager Parameter Store | mxgraph.aws4.parameter_store |
| Systems Manager OpsCenter | mxgraph.aws4.opscenter |
| AWS Config | mxgraph.aws4.config |
| AWS Service Catalog | mxgraph.aws4.service_catalog |
| AWS Trusted Advisor | mxgraph.aws4.trusted_advisor |
| AWS Control Tower | mxgraph.aws4.control_tower |
| AWS License Manager | mxgraph.aws4.license_manager |
| AWS Resource Explorer | mxgraph.aws4.resource_explorer |
| AWS Well-Architected | mxgraph.aws4.well_architected |
| AWS OpsWorks | mxgraph.aws4.opsworks |
| AWS Launch Wizard | mxgraph.aws4.launch_wizard |
| AWS Management Console | mxgraph.aws4.management_console |
| AWS Personal Health Dashboard | mxgraph.aws4.personal_health_dashboard |
| AWS Proton | mxgraph.aws4.proton |
| AWS Resilience Hub | mxgraph.aws4.resilience_hub |
| AWS Service Management Connector | mxgraph.aws4.service_management_connector |
| AWS Chatbot | mxgraph.aws4.chatbot |
| AWS Application Auto Scaling | mxgraph.aws4.application_auto_scaling |

### 3.11. Developer Tools (開発者ツール)

| サービス | resIcon |
|----------|---------|
| AWS CodeBuild | mxgraph.aws4.codebuild |
| AWS CodePipeline | mxgraph.aws4.codepipeline |
| AWS CodeCommit | mxgraph.aws4.codecommit |
| AWS CodeDeploy | mxgraph.aws4.codedeploy |
| AWS CodeArtifact | mxgraph.aws4.codeartifact |
| AWS CodeStar | mxgraph.aws4.codestar |
| AWS CodeCatalyst | mxgraph.aws4.codecatalyst |
| AWS Cloud9 | mxgraph.aws4.cloud9 |
| AWS X-Ray | mxgraph.aws4.xray |
| AWS CLI | mxgraph.aws4.command_line_interface |
| AWS SDK | mxgraph.aws4.sdk |
| AWS CloudShell | mxgraph.aws4.cloudshell |
| AWS CDK | mxgraph.aws4.cloud_development_kit |
| AWS Application Composer | mxgraph.aws4.application_composer |
| AWS Fault Injection Service | mxgraph.aws4.fault_injection_service |
| AWS Tools and SDKs | mxgraph.aws4.tools_and_sdks |
| AWS SAM | mxgraph.aws4.serverless_application_model |

### 3.12. Front-end Web & Mobile (フロントエンド)

| サービス | resIcon |
|----------|---------|
| AWS Amplify | mxgraph.aws4.amplify |
| AWS AppSync | mxgraph.aws4.appsync |
| Amazon API Gateway | mxgraph.aws4.api_gateway |
| Amazon Location Service | mxgraph.aws4.location_service |
| AWS Device Farm | mxgraph.aws4.device_farm |
| Amazon Pinpoint | mxgraph.aws4.pinpoint |

### 3.13. Customer Engagement (カスタマーエンゲージメント)

| サービス | resIcon |
|----------|---------|
| Amazon Pinpoint | mxgraph.aws4.pinpoint |
| Amazon SES | mxgraph.aws4.simple_email_service |
| Amazon Connect | mxgraph.aws4.connect |
| Amazon Connect Customer Profiles | mxgraph.aws4.connect_customer_profiles |
| Amazon Connect Wisdom | mxgraph.aws4.connect_wisdom |
| Amazon Connect Voice ID | mxgraph.aws4.connect_voice_id |

### 3.14. Business Applications (ビジネスアプリケーション)

| サービス | resIcon |
|----------|---------|
| Amazon Chime | mxgraph.aws4.chime |
| Amazon Chime SDK | mxgraph.aws4.chime_sdk |
| Amazon WorkMail | mxgraph.aws4.workmail |
| Amazon Honeycode | mxgraph.aws4.honeycode |
| AWS Supply Chain | mxgraph.aws4.supply_chain |
| AWS Wickr | mxgraph.aws4.wickr |

### 3.15. End User Computing (エンドユーザーコンピューティング)

| サービス | resIcon |
|----------|---------|
| Amazon WorkSpaces | mxgraph.aws4.workspaces |
| Amazon WorkSpaces Web | mxgraph.aws4.workspaces_web |
| Amazon AppStream 2.0 | mxgraph.aws4.appstream |
| AppStream 2.0 (v2) | mxgraph.aws4.appstream_20 |
| Amazon WorkDocs | mxgraph.aws4.workdocs |
| Amazon WorkLink | mxgraph.aws4.worklink |
| NICE DCV | mxgraph.aws4.nice_dcv |

### 3.16. Internet of Things (IoT)

| サービス | resIcon |
|----------|---------|
| AWS IoT Core | mxgraph.aws4.iot_core |
| IoT MQTT Protocol | mxgraph.aws4.mqtt_protocol |
| IoT HTTP Protocol | mxgraph.aws4.http_protocol |
| IoT HTTP2 Protocol | mxgraph.aws4.http2_protocol |
| IoT Rule | mxgraph.aws4.iot_rule |
| IoT Action | mxgraph.aws4.iot_action |
| IoT Topic | mxgraph.aws4.iot_topic |
| IoT Shadow | mxgraph.aws4.iot_shadow |
| IoT Certificate | mxgraph.aws4.iot_certificate |
| IoT Policy | mxgraph.aws4.iot_policy |
| IoT Hardware Board | mxgraph.aws4.iot_hardware_board |
| IoT Sensor | mxgraph.aws4.sensor |
| IoT Servo | mxgraph.aws4.servo |
| IoT Actuator | mxgraph.aws4.actuator |
| IoT Reported State | mxgraph.aws4.reported_state |
| IoT Desired State | mxgraph.aws4.desired_state |
| AWS IoT Greengrass | mxgraph.aws4.iot_greengrass |
| IoT Greengrass Connector | mxgraph.aws4.greengrass_connector |
| AWS IoT Analytics | mxgraph.aws4.iot_analytics |
| IoT Analytics Channel | mxgraph.aws4.iot_analytics_channel |
| IoT Analytics Pipeline | mxgraph.aws4.iot_analytics_pipeline |
| IoT Analytics Data Store | mxgraph.aws4.iot_analytics_data_store |
| IoT Analytics Data Set | mxgraph.aws4.iot_analytics_data_set |
| IoT Analytics Notebook | mxgraph.aws4.iot_analytics_notebook |
| AWS IoT Device Defender | mxgraph.aws4.iot_device_defender |
| AWS IoT Device Management | mxgraph.aws4.iot_device_management |
| AWS IoT Events | mxgraph.aws4.iot_events |
| AWS IoT SiteWise | mxgraph.aws4.iot_sitewise |
| AWS IoT Things Graph | mxgraph.aws4.iot_things_graph |
| AWS IoT 1-Click | mxgraph.aws4.iot_1click |
| AWS IoT Button | mxgraph.aws4.iot_button |
| AWS IoT FleetWise | mxgraph.aws4.iot_fleetwise |
| AWS IoT RoboRunner | mxgraph.aws4.iot_roborunner |
| AWS IoT TwinMaker | mxgraph.aws4.iot_twinmaker |
| FreeRTOS | mxgraph.aws4.freertos |

### 3.17. Migration & Transfer (移行・転送)

| サービス | resIcon |
|----------|---------|
| AWS DMS | mxgraph.aws4.database_migration_service |
| DMS Database Migration Workflow | mxgraph.aws4.database_migration_workflow_job |
| AWS Snowball | mxgraph.aws4.snowball |
| Snowball Import Export | mxgraph.aws4.snowball_import_export |
| AWS Snowcone | mxgraph.aws4.snowcone |
| AWS Snowmobile | mxgraph.aws4.snowmobile |
| AWS Transfer Family | mxgraph.aws4.transfer_family |
| AWS Migration Hub | mxgraph.aws4.migration_hub |
| Migration Hub Orchestrator | mxgraph.aws4.migration_hub_orchestrator |
| Migration Hub Refactor Spaces | mxgraph.aws4.migration_hub_refactor_spaces |
| AWS Application Migration | mxgraph.aws4.application_migration_service |
| AWS Application Discovery Service | mxgraph.aws4.application_discovery_service |
| AWS DataSync | mxgraph.aws4.datasync |
| DataSync Agent | mxgraph.aws4.datasync_agent |
| AWS Mainframe Modernization | mxgraph.aws4.mainframe_modernization |

### 3.18. Media Services (メディアサービス)

| サービス | resIcon |
|----------|---------|
| AWS Elemental MediaConvert | mxgraph.aws4.mediaconvert |
| AWS Elemental MediaLive | mxgraph.aws4.medialive |
| AWS Elemental MediaPackage | mxgraph.aws4.mediapackage |
| AWS Elemental MediaStore | mxgraph.aws4.mediastore |
| AWS Elemental MediaTailor | mxgraph.aws4.mediatailor |
| AWS Elemental MediaConnect | mxgraph.aws4.mediaconnect |
| AWS Elemental Appliances | mxgraph.aws4.elemental_appliances |
| AWS Elemental Link | mxgraph.aws4.elemental_link |
| AWS Elemental Server | mxgraph.aws4.elemental_server |
| AWS Elemental Conductor | mxgraph.aws4.elemental_conductor |
| AWS Elemental Delta | mxgraph.aws4.elemental_delta |
| AWS Elemental Live | mxgraph.aws4.elemental_live |
| Amazon Elastic Transcoder | mxgraph.aws4.elastic_transcoder |
| Amazon Interactive Video Service | mxgraph.aws4.ivs |
| Amazon Nimble Studio | mxgraph.aws4.nimble_studio |
| AWS Deadline Cloud | mxgraph.aws4.deadline_cloud |

### 3.19. Game Tech (ゲーム開発)

| サービス | resIcon |
|----------|---------|
| Amazon GameLift | mxgraph.aws4.gamelift |
| Amazon GameSparks | mxgraph.aws4.gamesparks |
| Open 3D Engine | mxgraph.aws4.open_3d_engine |
| Amazon Lumberyard | mxgraph.aws4.lumberyard |

### 3.20. Cost Management (コスト管理)

| サービス | resIcon |
|----------|---------|
| AWS Cost Explorer | mxgraph.aws4.cost_explorer |
| AWS Budgets | mxgraph.aws4.budgets |
| AWS Cost and Usage Report | mxgraph.aws4.cost_and_usage_report |
| Reserved Instance Reporting | mxgraph.aws4.reserved_instance_reporting |
| Savings Plans | mxgraph.aws4.savings_plans |
| AWS Billing Conductor | mxgraph.aws4.billing_conductor |
| AWS Application Cost Profiler | mxgraph.aws4.application_cost_profiler |

### 3.21. Blockchain (ブロックチェーン)

| サービス | resIcon |
|----------|---------|
| Amazon Managed Blockchain | mxgraph.aws4.managed_blockchain |
| Amazon QLDB | mxgraph.aws4.qldb |

### 3.22. Quantum Technologies (量子技術)

| サービス | resIcon |
|----------|---------|
| Amazon Braket | mxgraph.aws4.braket |

### 3.23. Satellite (衛星)

| サービス | resIcon |
|----------|---------|
| AWS Ground Station | mxgraph.aws4.ground_station |

### 3.24. Robotics (ロボティクス)

| サービス | resIcon |
|----------|---------|
| AWS RoboMaker | mxgraph.aws4.robomaker |
| RoboMaker Simulation | mxgraph.aws4.robomaker_simulation |
| RoboMaker Development Environment | mxgraph.aws4.robomaker_development_environment |
| RoboMaker Fleet Management | mxgraph.aws4.robomaker_fleet_management |
| RoboMaker Cloud Extension | mxgraph.aws4.robomaker_cloud_extension |

### 3.25. General/Generic Icons (汎用アイコン)

| 説明 | resIcon |
|------|---------|
| Users | mxgraph.aws4.users |
| User | mxgraph.aws4.user |
| Client | mxgraph.aws4.client |
| Internet | mxgraph.aws4.internet |
| Internet (v2) | mxgraph.aws4.internet_2 |
| Mobile Client | mxgraph.aws4.mobile_client |
| Mobile | mxgraph.aws4.mobile |
| Desktop | mxgraph.aws4.illustration_desktop |
| Laptop | mxgraph.aws4.laptop |
| Tablet | mxgraph.aws4.tablet |
| Browser | mxgraph.aws4.browser |
| Traditional Server | mxgraph.aws4.traditional_server |
| Generic Database | mxgraph.aws4.generic_database |
| Generic Firewall | mxgraph.aws4.generic_firewall |
| General | mxgraph.aws4.general |
| AWS Cloud | mxgraph.aws4.aws_cloud |
| Data Center | mxgraph.aws4.data_center |
| Corporate Data Center | mxgraph.aws4.corporate_data_center |
| On-Premises | mxgraph.aws4.on_premises |
| Folder | mxgraph.aws4.folder |
| Forums | mxgraph.aws4.forums |
| Office Building | mxgraph.aws4.office_building |
| SAML Token | mxgraph.aws4.saml_token |
| SSL Padlock | mxgraph.aws4.ssl_padlock |
| Tape Storage | mxgraph.aws4.tape_storage |
| Toolkit | mxgraph.aws4.toolkit |
| Generic SDK | mxgraph.aws4.generic_sdk |
| Disk | mxgraph.aws4.disk |
| External SDK | mxgraph.aws4.external_sdk |

## 4. グループアイコン

### 4.1. 基本構文

```xml
shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.{group_name};
```

### 4.2. グループアイコン一覧

| 説明 | grIcon |
|------|--------|
| AWS Cloud | mxgraph.aws4.group_aws_cloud |
| AWS Cloud (Alt) | mxgraph.aws4.group_aws_cloud_alt |
| Region | mxgraph.aws4.group_region |
| VPC | mxgraph.aws4.group_vpc |
| Availability Zone | mxgraph.aws4.group_availability_zone |
| Security Group | mxgraph.aws4.group_security_group |
| Public Subnet | mxgraph.aws4.group_public_subnet |
| Private Subnet | mxgraph.aws4.group_private_subnet |
| AWS Account | mxgraph.aws4.group_aws_account |
| Corporate Data Center | mxgraph.aws4.group_corporate_data_center |
| EC2 Instance Contents | mxgraph.aws4.group_ec2_instance_contents |
| Elastic Beanstalk Container | mxgraph.aws4.group_elastic_beanstalk_container |
| Auto Scaling | mxgraph.aws4.group_auto_scaling |
| Spot Fleet | mxgraph.aws4.group_spot_fleet |
| AWS Step Functions Workflow | mxgraph.aws4.group_step_functions_workflow |
| Generic Group | mxgraph.aws4.group_generic |
| AWS IoT Greengrass Deployment | mxgraph.aws4.group_iot_greengrass_deployment |
| Server Contents | mxgraph.aws4.group_server_contents |

### 4.3. 使用例

```xml
<!-- AWS Cloud -->
<mxCell style="shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud;..." />

<!-- VPC -->
<mxCell style="shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc;..." />

<!-- Availability Zone -->
<mxCell style="shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_availability_zone;..." />

<!-- Public Subnet -->
<mxCell style="shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_public_subnet;fillColor=#E9F3E6;..." />

<!-- Private Subnet -->
<mxCell style="shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_private_subnet;fillColor=#E6F2F8;..." />
```

## 5. アイコン検索スクリプト

[scripts/find_aws_icon.py](../scripts/find_aws_icon.py) を使用して効率的に検索可能。

## 6. 参考リンク

- [draw.io AWS Diagrams Blog](https://www.drawio.com/blog/aws-diagrams)
- [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/)
- [jgraph/drawio GitHub](https://github.com/jgraph/drawio)
- [awsicons.dev](https://awsicons.dev/)
- [diagrams-aws-icons](https://github.com/m-radzikowski/diagrams-aws-icons)
