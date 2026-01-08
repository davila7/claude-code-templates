# Deepspeed - Other

**Pages:** 15

---

## Training Overview and Features

**URL:** https://www.deepspeed.ai/training/

**Contents:**
- Training Overview and Features
    - Contents
- Overview
- Distributed, Effective, and Efficient Training with Ease
- Speed
- Memory efficiency
- Scalability
- Communication efficiency
- Data efficiency
- Supporting long sequence length

Training advanced deep learning models is challenging. Beyond model design, model scientists also need to set up the state-of-the-art training techniques such as distributed training, mixed precision, gradient accumulation, and checkpointing. Yet still, scientists may not achieve the desired system performance and convergence rate. Large model sizes are even more challenging: a large model easily runs out of memory with pure data parallelism and it is difficult to use model parallelism. DeepSpeed addresses these challenges to accelerate model development and training.

The DeepSpeed API is a lightweight wrapper on PyTorch. This means that you can use everything you love in PyTorch and without learning a new platform. In addition, DeepSpeed manages all of the boilerplate state-of-the-art training techniques, such as distributed training, mixed precision, gradient accumulation, and checkpoints so that you can focus on your model development. Most importantly, you can leverage the distinctive efficiency and effectiveness benefit of DeepSpeed to boost speed and scale with just a few lines of code changes to your PyTorch models.

DeepSpeed achieves high performance and fast convergence through a combination of efficiency optimizations on compute/communication/memory/IO and effectiveness optimizations on advanced hyperparameter tuning and optimizers. For example:

DeepSpeed trains BERT-large to parity in 44 mins using 1024 V100 GPUs (64 DGX-2 boxes) and in 2.4 hours using 256 GPUs (16 DGX-2 boxes).

BERT-large Training Times

BERT code and tutorials will be available soon.

DeepSpeed trains GPT2 (1.5 billion parameters) 3.75x faster than state-of-art, NVIDIA Megatron on Azure GPUs.

Read more: GPT tutorial

DeepSpeed provides memory-efficient data parallelism and enables training models without model parallelism. For example, DeepSpeed can train models with up to 13 billion parameters on a single GPU. In comparison, existing frameworks (e.g., PyTorch’s Distributed Data Parallel) run out of memory with 1.4 billion parameter models.

DeepSpeed reduces the training memory footprint through a novel solution called Zero Redundancy Optimizer (ZeRO). Unlike basic data parallelism where memory states are replicated across data-parallel processes, ZeRO partitions model states and gradients to save significant memory. Furthermore, it also reduces activation memory and fragmented memory. The current implementation (ZeRO-2) reduces memory by up to 8x relative to the state-of-art. You can read more about ZeRO in our paper, and in our blog posts related to ZeRO-1 and ZeRO-2.

With this impressive memory reduction, early adopters of DeepSpeed have already produced a language model (LM) with over 17B parameters called Turing-NLG, establishing a new SOTA in the LM category.

For model scientists with limited GPU resources, ZeRO-Offload leverages both CPU and GPU memory for training large models. Using a machine with a single GPU, our users can run models of up to 13 billion parameters without running out of memory, 10x bigger than the existing approaches, while obtaining competitive throughput. This feature democratizes multi-billion-parameter model training and opens the window for many deep learning practitioners to explore bigger and better models.

DeepSpeed supports efficient data parallelism, model parallelism, pipeline parallelism and their combinations, which we call 3D parallelism.

DeepSpeed can run large models more efficiently, up to 10x faster for models with various sizes spanning 1.5B to hundred billion. More specifically, the data parallelism powered by ZeRO is complementary and can be combined with different types of model parallelism. It allows DeepSpeed to fit models using lower degree of model parallelism and higher batch size, offering significant performance gains compared to using model parallelism alone.

Read more: ZeRO paper, and GPT tutorial.

The figure depicts system throughput improvements of DeepSpeed (combining ZeRO-powered data parallelism with model parallelism of NVIDIA Megatron-LM) over using Megatron-LM alone.

Pipeline parallelism of DeepSpeed reduce communication volume during distributed training, which allows users to train multi-billion-parameter models 2–7x faster on clusters with limited network bandwidth.

1-bit Adam, 0/1 Adam and 1-bit LAMB reduce communication volume by up to 26x while achieving similar convergence efficiency to Adam, allowing for scaling to different types of GPU clusters and networks. 1-bit Adam blog post, 1-bit Adam tutorial, 0/1 Adam tutorial, 1-bit LAMB tutorial.

DeepSpeed Data Efficiency Library provides efficient data sampling via curriculum learning and efficient data routing via random layerwise token dropping. The composed solution enables up to 2x data and 2x time saving during GPT-3/BERT pretraining and GPT/ViT finetuning, or further improve model quality under the same data/time. See more in the tutorial.

DeepSpeed offers sparse attention kernels—an instrumental technology to support long sequences of model inputs, whether for text, image, or sound. Compared with the classic dense Transformers, it powers an order-of-magnitude longer input sequence and obtains up to 6x faster execution with comparable accuracy. It also outperforms state-of-the-art sparse implementations with 1.5–3x faster execution. Furthermore, our sparse kernels support efficient execution of flexible sparse format and empower users to innovate on their custom sparse structures. Read more here.

DeepSpeed supports advanced hyperparameter tuning and large batch size optimizers such as LAMB. These improve the effectiveness of model training and reduce the number of samples required to convergence to desired accuracy.

Read more: Tuning tutorial.

Only a few lines of code changes are needed to enable a PyTorch model to use DeepSpeed and ZeRO. Compared to current model parallelism libraries, DeepSpeed does not require a code redesign or model refactoring. It also does not put limitations on model dimensions (such as number of attention heads, hidden sizes, and others), batch size, or any other training parameters. For models of up to 13 billion parameters, you can use ZeRO-powered data parallelism conveniently without requiring model parallelism, while in contrast, standard data parallelism will run out of memory for models with more than 1.4 billion parameters. In addition, DeepSpeed conveniently supports flexible combination of ZeRO-powered data parallelism with custom model parallelisms, such as tensor slicing of NVIDIA’s Megatron-LM.

Below we provide a brief feature list, see our detailed feature overview for descriptions and usage.

title: “Feature Overview” layout: single permalink: /features/ toc: true toc_label: “Contents” —

Enable 16-bit (FP16) training by in the deepspeed_config JSON.

Easily switch between single-GPU, single-node multi-GPU, or multi-node multi-GPU execution by specifying resources with a hostfile.

The script <client_entry.py> will execute on the resources specified in <hostfile>.

DeepSpeed provides pipeline parallelism for memory- and communication- efficient training. DeepSpeed supports a hybrid combination of data, model, and pipeline parallelism and has scaled to over one trillion parameters using 3D parallelism. Pipeline parallelism can also improve communication efficiency and has accelerated training by up to 7x on low-bandwidth clusters.

DeepSpeed supports all forms of model parallelism including tensor slicing based approaches such as the Megatron-LM. It does so by only requiring the model parallelism framework to provide a model parallelism unit (mpu) that implements a few bookkeeping functionalities:

DeepSpeed is fully compatible with Megatron. Please see the Megatron-LM tutorial for details.

The Zero Redundancy Optimizer (ZeRO) is at the heart of DeepSpeed and enables large model training at a scale that is simply not possible with model parallelism alone. When enabled, ZeRO allows training models with over 13 billion parameters without any model parallelism, and up to 200 billion parameter models with model parallelism on current generation hardware.

For more details see the ZeRO paper, GPT tutorial on integration with DeepSpeed.

Optimizer State and Gradient Partitioning in ZeRO reduces the memory consumption of the model states (optimizer states, gradients and parameters) by 8x compared to standard data parallelism by partitioning these states across data parallel process instead of replicating them.

Activation Partitioning is a memory optimization in ZeRO that can reduce the memory consumed by activations during model parallel training (MP). In MP certain activations maybe required by all MP processes, resulting in a replication of activations across MP GPUs. Activation Partitioning stores these activations in a partitioned state once they are used for computation in the forward propagation. These activations are allgathered right before they are needed again during the backward propagation. By storing activations in a partitioned state, ZeRO in DeepSpeed can reduce the activation memory footprint proportional to the MP degree.

CBO enables high network and memory throughput while restricting memory usage to a constant size. For memory- and network-bound operations such as normalization or allreduce collectives, the performance depends on the size of the operand. Simply fusing all operands into a single large operand can enable great throughput at the expense of unnecessary memory overhead. CBO in DeepSpeed fuses smaller operands into approximately a pre-defined sized buffer large enough to achieve great performance without the unnecessary memory overhead.

CMO reduces memory fragmentation during training, preventing out of memory errors due to lack of contiguous memory. Memory fragmentation is a result of interleaving between short lived and long lived memory objects. During the forward propagation activation checkpoints are long lived but the activations that recomputed are short lived. Similarly, during the backward computation, the activation gradients are short lived while the parameter gradients are long lived. CMO transfers activation checkpoints and parameter gradients to contiguous buffers preventing memory fragmentation.

ZeRO-Offload pushes the boundary of the maximum model size that can be trained efficiently using minimal GPU resources, by exploiting computational and memory resources on both GPUs and their host CPUs. It allows training up to 13-billion-parameter models on a single NVIDIA V100 GPU, 10x larger than the state-of-the-art, while retaining high training throughput of over 30 teraflops per GPU.

For more details see the ZeRO-Offload release blog, and tutorial on integration with DeepSpeed.

Gradient accumulation allows running larger batch size with limited memory by breaking an effective batch into several sequential micro-batches, and averaging the parameter gradients across these micro-batches. Furthermore, instead of averaging the gradients of each micro-batch across all GPUs, the gradients are averaged locally during each step of the sequence, and a single allreduce is done at the end of the sequence to produce the averaged gradients for the effective batch across all GPUs. This strategy significantly reduces the communication involved over the approach of averaging globally for each micro-batch, specially when the number of micro-batches per effective batch is large.

During back propagation, DeepSpeed can overlap the communication required for averaging parameter gradients that have already been computed with the ongoing gradient computation. This computation-communication overlap allows DeepSpeed to achieve higher throughput even at modest batch sizes.

The DeepSpeed core API consists of just a handful of methods:

DeepSpeed supports most of the features described in this document, via the use of these API, along with a deepspeed_config JSON file for enabling and disabling the features. Please see the core API doc for more details.

DeepSpeed’s Activation Checkpointing API supports activation checkpoint partitioning, cpu checkpointing, and contiguous memory optimizations, while also allowing layerwise profiling. Please see the core API doc for more details.

DeepSpeed handles gradient clipping under the hood based on the max gradient norm specified by the user. Please see the core API doc for more details.

DeepSpeed internally handles loss scaling for mixed precision training. The parameters for loss scaling can be specified in the deepspeed_config JSON file. Please see the core API doc for more details.

DeepSpeed has three communication-efficient optimizers called 1-bit Adam, 0/1 Adam and 1-bit LAMB. They offer the same convergence as Adam/LAMB, incur up to 26x less communication that enables up to 6.6x higher throughput for BERT-Large pretraining and up to 2.7x higher throughput for SQuAD fine-tuning on bandwidth-limited clusters. For more details on usage and performance, please refer to the 1-bit Adam tutorial, 1-bit Adam blog post, 0/1 Adam tutorial and 1-bit LAMB tutorial. For technical details, please refer to the 1-bit Adam paper, 0/1 Adam paper and 1-bit LAMB paper.

With DeepSpeed, the user can choose to use a high performance implementation of ADAM from NVIDIA, or any training optimizer that extends torch’s torch.optim.Optimizer class.

We introduce an efficient implementation of Adam optimizer on CPU that improves the parameter-update performance by nearly an order of magnitude. We use the AVX SIMD instructions on Intel-x86 architecture for the CPU-Adam implementation. We support both AVX-512 and AVX-2 instruction sets. DeepSpeed uses AVX-2 by default which can be switched to AVX-512 by setting the build flag, DS_BUILD_AVX512 to 1 when installing DeepSpeed. Using AVX-512, we observe 5.1x to 6.5x speedups considering the model-size between 1 to 10 billion parameters with respect to torch-adam.

Mixed precision training is handled by the DeepSpeed FP16 Optimizer. This optimizer not only handles FP16 training but is also highly efficient. The performance of weight update is primarily dominated by the memory bandwidth, and the achieved memory bandwidth is dependent on the size of the input operands. The FP16 Optimizer is designed to maximize the achievable memory bandwidth by merging all the parameters of the model into a single large buffer, and applying the weight updates in a single kernel, allowing it to achieve high memory bandwidth.

DeepSpeed makes it easy to train with large batch sizes by enabling the LAMB Optimizer. For more details on LAMB, see the LAMB paper.

DeepSpeed can train models with up to 13 billion parameters without model parallelism, and models with up to 200 billion parameters with 16-way model parallelism. This leap in model size is possible through the memory efficiency achieved via the ZeRO Optimizer. For more details see ZeRO paper .

DeepSpeed can simplify checkpointing for you regardless of whether you are using data parallel training, model parallel training, mixed-precision training, a mix of these three, or using the zero optimizer to enable larger model sizes. Please see the Getting Started guide and the core API doc for more details.

DeepSpeed supports multiple Learning Rate Schedules to enable faster convergence for large batch scaling.

Please refer to the Learning Rate Range Test tutorial.

Please refer to the 1Cycle Learning Rate Schedule tutorial.

DeepSpeed abstracts away data parallelism and model parallelism from the user when it comes to data loading. Users simply provide a PyTorch dataset, and DeepSpeed data loader can automatically handle batch creation appropriately.

Please refer to the Data Efficiency tutorial.

Please refer to the Curriculum Learning tutorial. Note that the Data Efficiency Library above provides more general curriculum learning support. This legacy curriculum learning feature is still supported but we recommend to use the Data Efficiency Library.

DeepSpeed provides a set of tools for performance analysis and debugging.

DeepSpeed provides a detailed breakdown of the time spent in different parts of the training. This can be enabled by setting the following in the deepspeed_config file.

When activation checkpointing is enabled, profiling the forward and backward time of each checkpoint function can be enabled in the deepspeed_config file.

The DeepSpeed flops profiler measures the time, flops and parameters of a PyTorch model and shows which modules or layers are the bottleneck. When used with the DeepSpeed runtime, the flops profiler can be configured in the deepspeed_config file as follows:

The flops profiler can also be used as a standalone package. Please refer to the Flops Profiler tutorial for more details.

The DeepSpeed Autotuner uses model information, system information, and heuristics to efficiently tune Zero stage, micro batch size, and other Zero configurations. Using the autotuning feature requires no code change from DeepSpeed users. While "autotuning": {"enabled": true} is the minimal required to enable autotuning, there are other parameters users can define to configure the autotuning process. Below shows major parameters and their default values in the autotuning configuration. Please refer to the Autotuning tutorial for more details.

The flops profiler can also be used as a standalone package. Please refer to the Flops Profiler tutorial for more details.

The DeepSpeed Monitor logs live training metrics to one or more monitoring backends, including PyTorch’s TensorBoard, WandB, or simply to CSV files. The Monitor can be configured with one or more backends in the deepspeed_config file as follows:

The Monitor can also be added to log custom metrics and client codes. Please refer to the Monitor tutorial for more details.

DeepSpeed provides logging of all communication operations launched within deepspeed.comm. The communication logger can be configured in the deepspeed_config file as follows:

Client codes can then print a summary with a call to deepspeed.comm.log_summary(). For more details and example usage, see the Communication Logging tutorial.

DeepSpeed offers sparse attention to support long sequences. Please refer to the Sparse Attention tutorial.

To learn more about training Mixture of Experts (MoE) models with DeepSpeed, see our tutorial for more details.

**Examples:**

Example 1 (unknown):
```unknown
"fp16": {
    "enabled": true,
    "loss_scale": 0,
    "loss_scale_window": 1000,
    "hysteresis": 2,
    "consecutive_hysteresis": false,
    "min_loss_scale": 1
}
```

Example 2 (unknown):
```unknown
deepspeed --hostfile=<hostfile> \
	<client_entry.py> <client args> \
	--deepspeed --deepspeed_config ds_config.json
```

Example 3 (unknown):
```unknown
mpu.get_model_parallel_rank()
mpu.get_model_parallel_group()
mpu.get_model_parallel_world_size()

mpu.get_data_parallel_rank()
mpu.get_data_parallel_group()
mpu.get_data_parallel_world_size()
```

Example 4 (unknown):
```unknown
{
  "gradient_clipping": 1.0
}
```

---

## Latest News

**URL:** https://www.deepspeed.ai/

**Contents:**
- Latest News
    - Contents
- Extreme Speed and Scale for DL Training
- DeepSpeed Adoption
- Contributing
- Contributor License Agreement
- Code of Conduct
- Publications
- Videos

[2025/10] SuperOffload: Unleashing the Power of Large-Scale LLM Training on Superchips

[2025/10] Study of ZenFlow and ZeRO offload performance with DeepSpeed CPU core binding

[2025/08] ZenFlow: Stall-Free Offloading Engine for LLM Training

[2025/06] Arctic Long Sequence Training (ALST) with DeepSpeed: Scalable And Efficient Training For Multi-Million Token Sequences

[2025/06] DeepNVMe: Affordable I/O scaling for Deep Learning Applications

DeepSpeed enabled the world’s most powerful language models (at the time of this writing) such as MT-530B and BLOOM. DeepSpeed offers a confluence of system innovations, that has made large scale DL training effective, and efficient, greatly improved ease of use, and redefined the DL training landscape in terms of scale that is possible. These innovations include ZeRO, 3D-Parallelism, DeepSpeed-MoE, ZeRO-Infinity, etc.

DeepSpeed has been used to train many different large-scale models. Below is a list of several examples that we are aware of (if you’d like to include your model please submit a PR):

DeepSpeed has been integrated with several different popular open-source DL frameworks such as:

DeepSpeed is an integral part of Microsoft’s AI at Scale initiative to enable next-generation AI capabilities at scale.

DeepSpeed welcomes your contributions! Please see our contributing guide for more details on formatting, testing, etc.

This project welcomes contributions and suggestions. Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the Microsoft Open Source Code of Conduct. For more information see the Code of Conduct FAQ or contact opencode@microsoft.com with any additional questions or comments.

Xinyu Lian, Sam Ade Jacobs, Lev Kurilenko, Masahiro Tanaka, Stas Bekman, Olatunji Ruwase, Minjia Zhang. (2024) Universal Checkpointing: Efficient and Flexible Checkpointing for Large Scale Distributed Training arXiv:2406.18820

---

## Supporting efficient large model training on AMD Instinct GPUs with DeepSpeed

**URL:** https://www.deepspeed.ai/2022/03/20/amd-support.html

**Contents:**
- Supporting efficient large model training on AMD Instinct GPUs with DeepSpeed
    - Contents

Updated: March 20, 2022

---

## DeepSpeed Configuration JSON

**URL:** https://www.deepspeed.ai/docs/config-json/

**Contents:**
- DeepSpeed Configuration JSON
    - Contents
  - Batch Size Related Parameters
  - Optimizer Parameters
  - Scheduler Parameters
  - Communication options
  - FP16 training options
  - BFLOAT16 training options
  - Automatic mixed precision (AMP) training options
  - Gradient Clipping

Note: train_batch_size must be equal to train_micro_batch_size_per_gpu * gradient_accumulation_steps * number of GPUs. For simplicity, you can choose to only specify two of the three parameters, the last one will be inferred automatically by DeepSpeed.

train_batch_size: [integer]

train_micro_batch_size_per_gpu: [integer]

gradient_accumulation_steps: [integer]

optimizer: [dictionary]

Example of optimizer with Adam

The Adam optimizer also supports the following two params keys/values in addition to the standard parameters from torch.optim.Adam:

Another example of optimizer with 1-bit Adam specific parameters is as follows.

The 1-bit Adam optimizer supports the following three params keys/values in addition to the standard Adam (learn more in our tutorial):

A variant optimizer for 1-bit Adam is 0/1 Adam, which further optimizes 1-bit Adam via adaptive variance freezing and 1-bit synchronization over optimizer states.

0/1 Adam supports the following params key/values in addition to standard Adam (learn more in our tutorial.)

Another example of optimizer with 1-bit LAMB

The 1-bit LAMB optimizer supports the following params keys/values in addition to the standard LAMB (learn more in our tutorial):

DeepSpeed calls the step() method of the scheduler at every training step when model_engine.step() is executed.

scheduler: [dictionary]

communication_data_type: [string]

prescale_gradients: [boolean]

gradient_predivide_factor: [float]

sparse_gradients: [boolean]

Note: this mode cannot be combined with the amp mode described below.

fp16:enabled: [boolean]

fp16:auto_cast: [boolean]

fp16:loss_scale: [float]

fp16:initial_scale_power: [integer]

fp16:loss_scale_window: [integer]

fp16:hysteresis: [integer]

fp16:consecutive_hysteresis: [boolean]

fp16:min_loss_scale: [integer]

Note: this mode cannot be combined with the amp mode described below.

Note: this mode cannot be combined with the fp16 mode described above.

bf16:enabled: [boolean]

Note: this mode cannot be combined with the fp16 mode described above. In addition this mode is not currently compatible with ZeRO.

amp:enabled: [boolean]

amp params: [various]

gradient_clipping: [float]

Enabling and configuring ZeRO memory optimizations

zero_optimization: [dictionary]

allgather_partitions: [boolean]

allgather_bucket_size: [integer]

overlap_comm: [boolean]

reduce_scatter: [boolean]

reduce_bucket_size: [integer]

contiguous_gradients: [boolean]

load_from_fp32_weights: [boolean]

grad_hooks: [boolean]

round_robin_gradients: [boolean]

offload_param: [dictionary]

offload_optimizer: [dictionary]

stage3_max_live_parameters: [integer]

stage3_max_reuse_distance: [integer]

stage3_prefetch_bucket_size: [integer]

stage3_param_persistence_threshold: [integer]

stage3_gather_16bit_weights_on_model_save: [boolean]

stage3_module_granularity_threshold: [integer] | Description | Default | |——————————————————————————————————————————————————————————————————————————————————————————–| ——- | | The granularity of a module is determined by the ratio of parameter_count / (1 + descendant_count). ZeRO3 classifies modules with a granularity below the threshold as fine-grained, treating them as integral units during parameter fetching. This reduces host and communication overhead from separate hooks. | 0 |

zero_hpz_partition_size: [integer]

zero_quantized_weights: [boolean]

zero_quantized_gradients: [boolean]

log_trace_cache_warnings: [boolean]

cpu_offload: [boolean]

Deprecated: cpu_offload is deprecated and will be removed in future, please use offload_optimizer instead.

Enabling and configuring ZeRO optimization of parameter offloading to CPU/NVMe. Available only with ZeRO stage 3. Note that if the value of “device” is not specified or not supported, an assertion will be triggered.

pin_memory: [boolean]

buffer_count: [integer]

buffer_size: [integer]

max_in_cpu: [integer]

Enabling and configuring ZeRO optimization of offloading optimizer computation to CPU and state to CPU/NVMe. CPU offloading is available with ZeRO stage 1, 2, 3. NVMe offloading is available only with ZeRO stage 3. Note that if the value of “device” is not specified or not supported, an assertion will be triggered.

pin_memory: [boolean]

buffer_count: [integer]

Configuring the asynchronous I/O module for offloading parameter and optimizer states to persistent (NVMe) storage. This module uses Linux native asynchronous I/O (libaio).

block_size: [integer]

queue_depth: [integer]

thread_count: [integer]

single_submit: [boolean]

overlap_events: [boolean]

ignore_unused_parameters: [boolean]

steps_per_print: [integer]

wall_clock_breakdown: [boolean]

dump_state: [boolean]

results_dir: [string]

start_profile_step: [integer]

end_profile_step: [integer]

max_train_batch_size: [int]

num_tuning_micro_batch_sizes: [integer]

tuner_early_stopping: [integer]

tuner_num_trials: [integer]

profile_step: [integer]

module_depth: [integer]

top_modules: [integer]

output_file: [string]

partition_activations: [boolean]

cpu_checkpointing: [boolean]

contiguous_memory_optimization: [boolean]

number_checkpoints: [integer]

synchronize_checkpoint_boundary: [boolean]

sparse_attention: [dictionary]

Example of sparse_attention

DeepSpeed Data Efficiency Library includes two techniques: curriculum learning and random layerwise token dropping (random-LTD). Read more about how to use the DeepSpeed Data Efficiency Library in our tutorial.

data_efficiency: [dictionary]

data_routing: [dictionary]

data_sampling: [dictionary]

random_ltd: [dictionary]

curriculum_learning: [dictionary]

Note: On 12/12/2022, we released DeepSpeed Data Efficiency Library which provides a more general curriculum learning support. This legacy curriculum learning feature below is still supported but we recommend to use the Data Efficiency Library.

curriculum_type: [string]

min_difficulty: [integer]

max_difficulty: [integer]

schedule_type: [string]

total_curriculum_step: [integer]

difficulty_step: [integer]

root_degree: [integer]

difficulty: [list of integer]

max_step: [list of integer]

Note: Deepspeed logs to TensorBoard through PyTorch. Logging to TensorBoard requires that the tensorboard package is installed (read more in the PyTorch documentation).

Note: Logging to WandB requires that the wandb package is installed (read more in the WandB documentation).

Note: Logging to Comet requires that the comet_ml package is installed (read more in the Comet documentation).

Deepspeed’s Monitor module can log training details into a Tensorboard-compatible file, to WandB, to Comet or to simple CSV files. Below is an overview of what DeepSpeed will log automatically.

tensorboard: [dictionary]

Example of tensorboard configuration:

Example of wandb configuration:

Example of comet configuration:

csv_monitor: [dictionary]

Example of csv_monitor configuration:

DeepSpeed provides a flexible communication logging tool which can automatically detect and record communication operations launched via deepspeed.comm. NOTE: All logging communication calls are synchronized in order to provide accurate timing information. This may hamper performance if your model heavily uses asynchronous communication operations.

Once the logs are populated, they can be summarized with deepspeed.comm.log_summary(). For more detail and example usage, see the tutorial

comms_logger: [dictionary]

Example of recommended comms_logger configuration:

Example of comms_logger configuration for logging specific operations only:

Note: Compression has seven different components, including layer reduction, weight quantization, activation quantization, sparse pruning, row pruning, head pruning, and channel pruning. We explain them one by one with simple json examples. Read more about how to use the DeepSpeed Compression library in our tutorial.

Note: Layer reduction works much better when using knowledage distillation (learn more in our tutorial):

layer_reduction: [dictionary]

shared_parameters: [dictionary]

Shared parameters for all weight quantization groups.

different_groups: [dictionary]

Different quantization sets, this is used for different quantization parameters. In this example, we give two different sets. In practice, you can choose the number of sets based on your requirements.

shared_parameters: [dictionary]

Shared parameters for all activation quantization groups.

different_groups: [dictionary]

Different quantization sets, this is used for different quantization parameters. In this example, we give one set. In practice, you can choose the number of sets based on your requirements.

shared_parameters: [dictionary]

Shared parameters for all sparse pruning groups.

different_groups: [dictionary]

Different pruning sets, this is used for different pruning parameters. In this example, we give one set. In practice, you can choose the number of sets based on your requirements. Note for snip_momentum method, you can leave it as empty.

Note: Row Pruning is a feature designed for two back-to-back linear layers (e.g., Feed Forward Network in Transformers). As such, we suggested use row pruning for the first linear layer (i.e., the intermediate.dense layer for BERT). Reducing the row dimension of this matrix can help reducing the column of the follow-up matrix (i.e., layer.\\w+.output.dense layer for BERT). It should also work for other linear layers as well.

shared_parameters: [dictionary]

Shared parameters for all row pruning groups.

different_groups: [dictionary]

Different pruning sets, this is used for different pruning parameters. In this example, we give one set. In practice, you can choose the number of sets based on your requirements.

Note: Head Pruning is a feature designed for two attention layers (e.g., Multi Head Attention in Transformers). For now, it can only be applied to output matrix of the Transformer (i.e., attention.output.dense in BERT). Pruning the output matrix can lead to the pruning of Query/Key/Value matrix as well.

shared_parameters: [dictionary]

Shared parameters for all head pruning groups.

different_groups: [dictionary]

Different pruning sets, this is used for different pruning parameters. In this example, we give one set. In practice, you can choose the number of sets based on your requirements.

Note: Channel Pruning is a feature designed for two back-to-back CONV2d layers (e.g., residual connection in ResNet). As such, we suggested use channel pruning for the first CONV2d layer. Reducing the number of output channels of this layer can help reducing the number of input channels the follow-up layer. It should also work for other CONV2d layers as well.

shared_parameters: [dictionary]

Shared parameters for all channel pruning groups.

different_groups: [dictionary]

Different pruning sets, this is used for different pruning parameters. In this example, we give one set. In practice, you can choose the number of sets based on your requirements.

load_universal: [boolean]

use_node_local_storage: [boolean]

pipeline_stage: [boolean]

**Examples:**

Example 1 (unknown):
```unknown
"optimizer": {
    "type": "Adam",
    "params": {
      "lr": 0.001,
      "betas": [
        0.8,
        0.999
      ],
      "eps": 1e-8,
      "weight_decay": 3e-7
    }
  }
```

Example 2 (unknown):
```unknown
"optimizer": {
    "type": "OneBitAdam",
    "params": {
      "lr": 0.001,
      "betas": [
        0.8,
        0.999
      ],
      "eps": 1e-8,
      "weight_decay": 3e-7,
      "freeze_step": 400,
      "cuda_aware": false,
      "comm_backend_name": "nccl"
    }
  }
```

Example 3 (unknown):
```unknown
"optimizer": {
    "type": "ZeroOneAdam",
    "params": {
      "lr": 1e-3,
      "weight_decay": 0.01,
      "bias_correction": false,
      "var_freeze_step": 1000,
      "var_update_scaler": 16,
      "local_step_scaler": 1000,
      "local_step_clipper": 16,
      "cuda_aware": false,
      "comm_backend_name": "nccl"
    }
  }
```

Example 4 (unknown):
```unknown
"optimizer": {
    "type": "OneBitLamb",
    "params": {
      "lr": 11e-3,
      "weight_decay": 0.01,
      "bias_correction": false,
      "max_coeff": 0.3,
      "min_coeff": 0.01,
      "freeze_step": 1000,
      "cuda_aware": false,
      "comm_backend_name": "nccl",
      "coeff_beta": 0.9,
      "factor_max": 4.0,
      "factor_min": 0.5,
      "factor_threshold": 0.1
    }
  }
```

---

## DeepSpeed ZeRO-3 Offload

**URL:** https://www.deepspeed.ai/2021/03/07/zero3-offload.html

**Contents:**
- DeepSpeed ZeRO-3 Offload
    - Contents
- Overview of ZeRO family of technology
- ZeRO-3 Offload
- Unprecedented model scale
- Ease of supporting very large models
- Excellent training efficiency
- How to use ZeRO-3 Offload

Today we are announcing the release of ZeRO-3 Offload, a highly efficient and easy to use implementation of ZeRO Stage 3 and ZeRO Offload combined, geared towards our continued goal of democratizing AI by making efficient large-scale DL training available to everyone. The key benefits of ZeRO-3 Offload are:

The ZeRO Redundancy Optimizer (abbreviated ZeRO) is a family of memory optimization technologies for large-scale distributed deep learning. Unlike data parallelism (that is efficient but can only support a limited model size) or model parallelism (that can support larger model sizes but requires significant code refactoring while adding communication overhead that limits efficiency), ZeRO allows fitting larger models in memory without requiring code refactoring while remaining very efficient. ZeRO does so by eliminating the memory redundancy that is inherent in data parallelism while limiting the communication overhead to a minimum. ZeRO removes the memory redundancies across data-parallel processes by partitioning the three model states (optimizer states, gradients, and parameters) across data-parallel processes instead of replicating them. By doing this, it boosts memory efficiency compared to classic data-parallelism while retaining its computational granularity and communication efficiency. There are three stages in ZeRO corresponding to three model states, as shown in the Figure 1: the first stage (ZeRO-1) partitions only the optimizer states, the second stage (ZeRO-2) partitions both the optimizer states and the gradients and the final stage (ZeRO-3) partitions all three model states (for more details see the ZeRO paper).

Figure 1. Overview of ZeRO memory savings

In addition to these three stages, ZeRO family of technology also consists of ZeRO-2 Offload. ZeRO-2 Offload is a heterogeneous DL training technology that works in conjunction with ZeRO-2 to offload partitioned optimizer states and gradients to CPU memory. ZeRO-2 Offload offers the full memory advantage of ZeRO-2 even on a single GPU, while at the same time offering great scalability of ZeRO-2 on multi-GPU setup. DeepSpeed library has been offering ZeRO-2 Offload since Sept 2020. For details, please see below:

With today’s release of ZeRO-3 Offload, we are adding support for partitioning and offloading parameters in addition to optimizer states and gradients partitioning already supported by ZeRO-2 Offload in DeepSpeed. With parameter partitioning ZeRO-3 Offload implements the full set of features in the three stages of ZeRO, that allows for a linear growth in model size with the number of GPUs. In addition, ZeRO-3 Offload can also optionally offload all these model states to CPU to further reduce GPU memory consumption, leveraging both CPU and GPU to maximize memory and compute efficiency of the entire system.

We believe ZeRO-3 Offload offers a massive leap for large model training, in three regards:

i) Unprecedented model scale,

ii) Ease of supporting very-large models, and

iii) Achieving excellent training efficiency.

Unlike ZeRO-2 and ZeRO-Offload where the parameters have to fit in the memory of a single GPU, ZeRO-3 Offload can partition the parameters across GPUs, and offload them to CPU, supporting model sizes that are much larger than the memory on a single GPU. Furthermore, ZeRO-3 Offload goes beyond the state-of-the-art hybrid 3D-parallelism (data, model and pipeline parallelism combined). While 3D Parallelism is limited by the aggregate GPU memory, ZeRO-3 Offload can exploit both GPU and CPU memory, the latter of which is much larger and cheaper compared to GPU memory. This allows ZeRO-3 Offload to train larger model sizes with the given GPU and CPU resources than any other currently available technology.

Model Scale on Single GPU: ZeRO-3 Offload can train models with over 40B parameters efficiently on a single GPU (e.g., 32GB V100 GPU + 1.5TB CPU memory). This is 3x larger than what is possible with ZeRO-2 Offload, the current state-of-the art.

Model Scale on Multi-GPUs: With ZeRO-3 Offload you can train a trillion and two trillion parameter models on NVIDIA 32GB V100 DGX-2 cluster with 256 GPUs and 512 GPUs, respectively. In contrast, the state-of-art 3D Parallelism requires 800 GPUs, and 1600 GPUs, respectively, to fit the same sized models. This represents a 3x reduction in GPUs required to fit models with over a trillion parameters.

From a system perspective, training models with hundreds of billions and trillions of parameters is extremely challenging. Data parallelism cannot scale the model size much further beyond a billion parameters, model parallelism (with tensor slicing) cannot be used to scale model size efficiently beyond a single node boundary due to massive communication overheads, and pipeline parallelism cannot scale beyond the number of layers available in a model, which limits both the model size and the number of GPUs that it can scale to.

The only existing parallel technology available that can scale to over a trillion parameters on massively parallel GPU clusters is the 3D parallelism that combines data, model and pipeline parallelism in complex ways. While such a system can be very efficient, it requires major model code refactoring from data scientists to split the model into load balanced pipeline stages. This also makes 3D parallelism inflexible in the type of models that it can support, since models with complex dependency graphs cannot be easily converted into a load balanced pipeline.

ZeRO-3 Offload address these challenges in two ways:

i) With ground-breaking memory efficiency, ZeRO-3 and ZeRO-3 Offload are the only DL parallel technology that can efficiently scale to over a trillion parameters by itself, without requiring a hybrid parallelism strategy, greatly simplifying the system stack for DL training.

ii) ZeRO-3 Offload requires virtually no model refactoring from model scientists, liberating data scientists to scale up complex models to hundreds of billions to trillions of parameters.

High-performance per-GPU throughput on multiple nodes: ZeRO-3 Offload offers excellent training efficiency for multi-billion and trillion parameter models on multiple nodes. It achieves a sustained throughput of up to 50 Tflops per GPU running on 32 DGX2 nodes comprising 512 NVIDIA V100 GPUs (see Figure 2). In comparison, the standard data parallel training with PyTorch can only achieve 30 TFlops per GPU for a 1.2B parameter model, the largest model that can be trained using data parallelism alone.

Figure 2. ZeRO-3 Offload: Multi-billion and trillion parameter model throughput on 512 V100 GPUs

ZeRO-3 Offload obtains high efficiency despite the 50% communication overhead of ZeRO Stage 3 compared to standard data parallel training for a fixed batch size. This is made possible through a communication overlap centric design and implementation, which allows ZeRO-3 Offload to hide nearly all of the communication volume with computation, while taking advantage of a larger batch size for improved efficiency resulting from better GPU memory efficiency.

Efficient multi-billion parameter model training on a single GPU: ZeRO-3 Offload further democratizes AI by enabling efficient training of multi-billion parameter models on a single GPU. For single GPU training, ZeRO-3 Offload provides benefits over ZeRO-2 Offload along two dimensions. First, ZeRO-3 Offload increases the size of models trainable on a single V100 from 13B to 40B. Second, for ZeRO-3 Offload provides speedups (e.g., 2.3X for 13B) compared to ZeRO-2 Offload for model sizes trainable by both solutions. These results are summarized in Figure 3.

Figure 3. Multi-billion parameter model training on one V100 GPU

Super-Linear scalability across GPUs: Additionally, ZeRO-3 Offload also preserves the super-linear scalability characteristics that we have demonstrated with all our previous ZeRO technologies (ZeRO Stage 1, ZeRO Stage 2 and ZeRO Offload). ZeRO-3 Offload can exploit the aggregate PCI-E bandwidth between GPU and CPU across all the GPUs in multi-GPU training configuration, and at the same time, it can also exploit the aggregate CPU compute across all the nodes. As a result, the CPU-GPU-CPU communication time as well as the optimizer update time decreases linearly with number of GPUs and nodes, respectively, allowing ZeRO-3 Offload to exhibit super-linear scaling (see Figure 4).

Figure 4. ZeRO-3 Offload Superlinear Scalability for a 200B parameter model.

As with many other existing DeepSpeed features, once the user model has been converted to use DeepSpeed, enabling ZeRO-3 Offload is as easy as turning on a couple of flags in DeepSpeed Config file. Supporting advanced features like weight sharing, or enabling extremely large models that requires to be partitioned across GPUs/nodes to fit in GPU/CPU memory, can be done with just a couple of additional lines of code change using the ZeRO-3 Offload API.

If you are already a DeepSpeed user, you can find our detailed tutorial on ZeRO-3 Offload below. If you are new to DeepSpeed, we recommend that you start at the getting started page before trying out our ZeRO-3 Offload Tutorial.

DeepSpeed: Getting Started Page

ZeRO-3 Offload Documentation, Tutorial

The DeepSpeed Team is very excited to share ZeRO-3 Offload with the DL community.

Updated: March 7, 2021

---

## DeepSpeed: Advancing MoE inference and training to power next-generation AI scale

**URL:** https://www.deepspeed.ai/2022/01/18/moe-inference.html

**Contents:**
- DeepSpeed: Advancing MoE inference and training to power next-generation AI scale
    - Contents

Updated: January 18, 2022

---

## Azure empowers easy-to-use, high-performance, and hyperscale model training using DeepSpeed

**URL:** https://www.deepspeed.ai/2022/07/25/deepspeed-azure.html

**Contents:**
- Azure empowers easy-to-use, high-performance, and hyperscale model training using DeepSpeed
    - Contents
- Introduction
- Making distributed training faster and easier on Azure using DeepSpeed
- Key Performance Benefits
- Experimental Setup
  - Hardware (Azure instances)
  - Training setup using AzureML
  - Training setup using Azure VMSS
- Performance Evaluation on Various Model Configurations

Large-scale transformer-based deep learning models trained on large amounts of data have shown great results in recent years in several cognitive tasks and are behind new products and features that augment human capabilities. These models have grown several orders of magnitude in size during the last five years. Starting from a few million parameters of the original transformer model all the way to the latest 530 billion-parameter Megatron-Turing model as shown in Figure 1. There is a growing need for customers to train and fine tune large models at an unprecedented scale.

Figure 1: Landscape of large models and hardware capabilities

To train these models, users needed to set up and maintain a complex distributed training infrastructure that usually required several manual and error-prone steps. These lead to a subpar experience both in terms of usability and performance. We recently announced how we are making great strides to simplify this and enable easy-to-use and high-performance training at 1K+ GPU scale on Azure.

In this extended post, we share the details of how DeepSpeed users can train trillion-parameter models with a new easy-to-use, streamlined, scalable, and high-performance distributed training experience on Azure. We also share details of the experimental setup, model configurations, additional performance trends, and guide our users on how to run these experiments in their own environments.

We compare the existing manual and error-prone workflow with our proposed easy-to-use workflow for DeepSpeed on Azure in Figure 2. Customers can now use easy-to-use training pipelines to launch training jobs at scale. The new workflow reduces the number of steps from 11 to just 1 if users rely on the recommended AzureML recipes.

Figure 2: An easy-to-use and streamlined distributed training experience with DeepSpeed on Azure

For users who have custom environments built using Azure VMs or Azure VMSS, only two steps are needed:

We already shared a summary of our key performance results in the Azure announcement. We enable the capability to train 2x larger model sizes (2 trillion vs. 1 trillion parameters), scale to 2x more GPUs (1024 vs. 512), and offer up to 1.8x higher compute throughput/GPU (150 TFLOPs vs. 81 TFLOPs) compared to other cloud providers.

DeepSpeed on Azure offers near-linear scalability both in terms of increase in model size as well as increase in number of GPUs. As shown in Figure 3a, together with the DeepSpeed ZeRO-3, its novel CPU offloading capabilities, and a high-performance Azure stack powered by InfiniBand interconnects and A100 GPUs, we were able to maintain an efficient throughput/GPU (>157 TFLOPs) in a near-linear fashion as the model size increases from 175 billion parameters to 2 trillion parameters. On the other hand, for a given model size, e.g., 175B, we achieve near-linear scaling as we increase the number of GPUs from 128 all the way to 1024 as shown in Figure 3b. The key takeaway is that Azure and DeepSpeed together are breaking the GPU memory wall and enabling our customers to easily and efficiently train trillion-parameter models at scale.

Figure 3: (a) Near-perfect throughput/GPU as we increase the model size from 175 billion to 2 trillion parameters (BS/GPU=8). (b) Near-perfect performance scaling with the increase in number of GPU devices for the 175B model (BS/GPU=16). The sequence length is 1024 for both cases.

We share the details of our experimental setup and some of the best practices we followed. The users can either directly use them to reproduce our results or modify them to fit their own setup in terms of model scale as well as the scale of Azure hardware being provisioned.

We used NDm A100 v4-series instances in our experiments. Each instance includes two socket AMD EPYC 7V12 64-Core CPUs, 1.7TB main memory and eight A100 80GB GPUs. The system has a balanced PCIe topology connecting 4 GPU devices to each CPU socket. Each GPU within the VM is provided with its own dedicated, topology-agnostic 200 Gb/s NVIDIA Mellanox HDR InfiniBand connection providing an accelerated 200 Gbps high speed fabric. The DeepSpeed library exploits offload capabilities where the activation and optimizer states are allocated in the main memory. Hence, 1.7TB memory capacity per node helps us to scale to large model sizes.

Users can directly use the AzureML studio and use our published recipes to run experiments without any additional setup. This is the easiest and recommended way of running experiments on Azure.

Existing VMSS customers and others who have custom Azure VM based environments can follow the setup as follows. The scripts to make these steps easy will be released in the coming weeks. A cluster is created using Azure Virtual Machine Scale Sets (VMSS) to provision the desired number of compute nodes running the new Azure HPAI VM image specialized for extreme-scale deep learning applications using the software stack listed in Table 1.

Table 1: Detailed version information of the software packages in the Azure HPC VM image

Users can create a VMSS with up to 600 VM instances enabling up to 4,800 A100 GPUs. In addition to the VMSS for the compute nodes, we provision a distinct login node using an inexpensive D4s v4 (or similar) instance with 4-core Intel VCPU, running the same image, for compiling, launching, and monitoring jobs. The login node, compute nodes, and a shared storage filesystem are grouped within an Azure Virtual Network (vnet) allowing VMs to connect to each other over SSH and to shared NFS volume shown in Figure 4.

Figure 4: Organization of our VMSS-based experimental setup

We ran our experiments with four different model sizes – 175B, 530B, 1T, and 2T – using the configurations shown in Table 2.

Table 2: Model configuration

For each of these configurations, we report peak throughput of the system using TFLOPs/GPU as the main performance metric. To calculate TFLOPs, we use the formula used by the Megatron paper as shown below.

FLOPs/GPU = 96 * B * s * l * h2 * (1 + s/6h + V/(16*l*h))

B is batch size, s is sequence length, l is the number of layers, h is hidden size, and V is vocabulary size.

Figures 5a and 5b show the results of 175B model with sequence length 512 and 1024, respectively. We only scale to 512 GPUs for seq-length 512 as adding more GPUs shows similar performance. On the other hand, with sequence length 1024, we saw linear performance increase to 1024 GPUs. Overall, the peak throughput of 204.49 TFLOPs/GPU was achieved on 256 GPUs with a micro batch size of 32 and sequence length of 512.

Figure 5: Performance characteristics of 175B model on 512 and 1K GPUs respectively. The colored columns signify different micro batch sizes.

Next, we report the 530B model scaling. Previous results on the 530B MT-NLG model using DeepSpeed and Megatron-LM on 280 DGX A100 servers on the Selene supercomputer showed the peak throughput of 126 TFLOPS/GPU. However, we were able to surpass that throughput and achieved up to 171.37 TFLOPs/GPU on 128 NDm A100 v4-series A100 systems (i.e., 1024 GPUs) as shown in Figure 6.

The benefit of this 530B model is its simpler parallelization configuration as there is no tensor/pipeline parallelism. With ZeRO powered data parallelism, there are fewer heuristics required to optimally configure the distributed model. In addition, the consistent steady state performance of more than 140 TFLOPs/GPU for micro batch sizes >1 demonstrates a robust software and hardware platform.

Figure 6: Throughput achieved with a 530B parameter model on 512 and 1024 GPUs for micro-batch sizes per GPU of 1, 2, 4, and 8, with sequence length 1,024.

The 1T parameter model contains 128 layers with 160 attention heads. Training such an extreme-scale model is not an easy task. Figure 7 shows the throughput achieved for each of the model configurations we explored on 512 and 1024 GPUs. Peak throughput achieved was 165.36 TFLOPs/GPU for micro batch size of 8 across 1024 GPUs and the model reached steady state performance within the first 3-4 iterations.

Figure 7: Performance characteristics of 1T parameter model on 512 and 1024 GPUs with 1, 2, 4, and 8 micro batch sizes, with sequence length 1,024.

The 2T parameter model consists of 160 layers, 32k hidden dimension, and 128 attention heads. Given the large size of the model and the significant time required on 1024 GPUs, we limited our benchmark runs for the 2T model to a batch size of 8 per GPU with a sequence length of 1024. We were able to achieve 157 TFLOPs/GPU on 1,024 GPUs.

We recognize that DeepSpeed users are diverse and have different environments. In this tutorial, our focus is on making things simpler for users who plan to run large model training experiments on Azure.

The easiest way to do model training on Azure is via the Azure ML recipes. The job submission and data preparation scripts have been made available here. Users simply need to setup their Azure ML workspace following the guide and submit experiment using the aml_submit.py file.

Some users have customized environments built on top of Azure VMs and VMSS based clusters. To simplify training on such setups, we are working on an easy-to-use cluster setup script that will be published in the next few weeks. If you already have a cluster setup running, you can use the azure recipes for the 175B and the 1T model. The recipes can easily be modified to train other model configurations.

This blog post was written by the DeepSpeed team in collaboration with the AzureML and the AzureHPC team. We would like to acknowledge several individuals who made this work possible:

Updated: July 25, 2022

---

## DeepSpeed Data Efficiency: A composable library that makes better use of data, increases training efficiency, and improves model quality

**URL:** https://www.deepspeed.ai/2022/12/11/data-efficiency.html

**Contents:**
- DeepSpeed Data Efficiency: A composable library that makes better use of data, increases training efficiency, and improves model quality
    - Contents
- Efficient Data Sampling via Curriculum Learning
- Motivation
- Design
- Evaluation Results
- Efficient Data Routing via Random Layerwise Token Dropping
- Motivation
- Design
- Evaluation Results

Recently, large-scale deep learning models are empowering us to achieve more in many ways, such as improving programming efficiency by code generation and providing art inspiration by text-to-image generation. To enable these services and keep improving the quality, deep learning model architecture evolves rapidly, and the model size is also growing at a tremendous speed. For example, from GPT to GPT-3 the model size increased 1500x in 2 years. The increasing model size leads to unprecedented training cost, making it challenging for many AI practitioners to train their own models. On the other hand, a less-emphasized perspective is that data scale is actually increasing at a similar speed as model scale, and the training cost is proportional to both of them. In Figure 1 below we plot the model and data scales of several representative language models in the last 5 years. From the oldest model on the left to the newest models on the right, both the model and data scales increase at similar speed. This demonstrates the importance of improving data efficiency: achieve same model quality with less data and reduced training cost, or achieve better model quality with the same amount of data and similar training cost.

Figure 1: Model scale (number of parameters) and data scale (number of tokens consumed during training) of representative language models in the last 5 years.

There are two popular research directions among existing data efficiency techniques: Data sampling techniques aim to improve the convergence speed by sampling the most suitable next data batch from the whole data pool; Data routing techniques aim to reduce the computation by routing each data to only a subset of the model components. These techniques improve data and training efficiency, but existing solutions on them have limitations on extensibility, flexibility, and composability. They are commonly designed for specific training tasks, making them hard to be extended with customized strategies and making them less flexible to be applied on diverse workloads from different users. Furthermore, different techniques are implemented separately, making it challenging to compose multiple solutions to further improve data and training efficiency.

To address these challenges, we, the DeepSpeed team as part of Microsoft’s AI at Scale initiative, are proud to announce DeepSpeed Data Efficiency Library – a composable framework that makes better use of data, increases training efficiency, and improves model quality. DeepSpeed Data Efficiency takes extensibility, flexibility, and composability into consideration, and it specifically demonstrates the following innovations:

Efficient data sampling via curriculum learning. Curriculum learning (CL) improves data efficiency by sampling from easier data. We present a general curriculum learning library which enables users to employ curriculum learning to their models at maximum extensibility: users can easily analyze, index, and sample their training data based on various customizable strategies. Using this library, we were able to explore different CL strategies for GPT-3 and BERT pretraining and identify the best solution that provides up to 1.5x data saving while still maintaining similar model quality.

Efficient data routing via random layerwise token dropping. We present a novel data routing technique called random layerwise token dropping (random-LTD) to skip the computation of a subset of the input tokens at all middle layers. Random-LTD employs a simple yet effective routing strategy and requires minimal model architecture change. It is flexible to apply random-LTD to various tasks (GPT-3/BERT pretraining and GPT/ViT finetuning), and we achieve great data efficiency improvement (up to 1.5x data saving while still maintaining the model quality).

Seamlessly composing multiple methods. The proposed DeepSpeed Data Efficiency framework seamlessly composes the curriculum learning and random-LTD techniques, and only requires minimal changes on the user code side. Furthermore, by composing both methods we can achieve even better data and training efficiency: for GPT-3 1.3B pretraining, we achieve 2x data and 2x time savings together with better or similar model quality compared to the baseline training. When using the same amount of data, our approach further improves the model quality over the baseline. Users can also extend and contribute to the library by adding additional data efficiency techniques to compose together.

Each of these advances is explored further in the blog post below. For more about the technical details, please read our papers, “Random-LTD: Random and Layerwise Token Dropping Brings Efficient Training for Large-scale Transformers” which describes the random-LTD technique, and “DeepSpeed Data Efficiency: Improving Deep Learning Model Quality and Training Efficiency via Efficient Data Sampling and Routing” which describes the curriculum learning technique and overall DeepSpeed Data Efficiency framework.

Curriculum learning aims to improve training convergence speed by presenting relatively easier or simpler examples earlier during training. Building a curriculum learning solution usually requires two components: the difficulty metric (i.e., how to quantify the difficulty of each data sample) and the pacing function (i.e., how to decide the curriculum difficulty range when sampling next training data batch). Curriculum learning has been successfully applied to various training tasks, and last year we also released a specific curriculum learning technique (sequence length warmup) for GPT-style model pretraining (see technical details in our paper “The Stability-Efficiency Dilemma: Investigating Sequence Length Warmup for Training GPT Models” published in NeurIPS 2022). However, one common limitation among existing works is that there does not exist a generalized and extensible curriculum learning library, which allows practitioners to easily apply custom curriculum difficulty metrics, the combination of metrics, and pacing functions.

To solve the limitation of existing solutions, we design and implement a general curriculum learning library emphasizing the extensibility. It consists of three components as shown in Figure 2 below (top part). First, we use a data analyzer to perform the offline CPU-only data analysis which indexes the whole data pool based on any difficulty metric such as the sequence length, the vocabulary rarity, or anything defined by user. Next, during training, the curriculum scheduler determines the difficulty threshold for the current step based on a pacing function such as linear, rooted, or any strategy provided by users. Then the data sampler will sample the data with desired difficulty from the indexed data pool. Overall, this general implementation would enable users to explore curriculum learning on their workloads with maximum customizability (more technical details in our DeepSpeed Data Efficiency paper).

Figure 2: Design of the DeepSpeed Data Efficiency framework.

Using this general and extensible curriculum learning solution for GPT-3 and BERT-Large model pretraining, we are able to easily analyze and index the huge training data based on up to 7 difficulty metrics and enable better data and training efficiency. For GPT-3 pretraining, our solution with the best difficulty metric (combination of truncation-based sequence length and vocabulary rarity) achieves 1.5x data and training cost saving while still maintaining model quality as baseline (Table 1 Case (8) vs. (1)). For BERT-Large pretraining, our solution with the best difficulty metric (vocabulary rarity) achieves 1.5x saving while still maintaining model quality (Table 2 Case (8) vs. (1)). On the other hand, our solutions can further improve model quality when using the same amount of data as baseline (Table 1 Case (2) to (6), Table 2 Case (2) to (6)).

Table 1: GPT-3 1.3B pretraining data consumption and average evaluation accuracy on 19 tasks.

Table 2: BERT-Large pretraining data consumption and average GLUE finetuning score on 8 tasks.

Standard data routing usually feeds the full images/sequences into all layers of a model. However, this process may not be optimal for training efficiency since some parts of an image (or words of a sentence) do not require a frequent feature update. As such, the token dropping method has been proposed, which is illustrated in Figure 3 (b) below, to skip the compute of some tokens/words (i.e., G-2 tokens in Figure 3 (b)) of a sentence in order to save the compute cost.

Although existing methods show promising results, they also exhibit several caveats: (1) most works solely focus on BERT (encoder-only on text data) pretraining and do not include decoder pretraining and/or other modalities (e.g., images); (2) the ability to skip layers is limited, which bounds the total amount of compute saving. By analyzing existing methods, we found out the potential main issue that limits their skipping and coverage abilities is the loss of attention mechanism for G-2 tokens for all skipped layers, since multi-head attention focuses on different tokens at different layer depths and the attention map aligns with the dependency relation most strongly in the middle of transformer architectures.

To resolve this main issue, we propose random-LTD, a random and layerwise token dropping mechanism, which processes only a subset of tokens among the entire data batch for all middle layers in order to save compute cost (see more details in our Random-LTD paper). As such, each token rarely bypasses all middle layers and its dependency with other tokens can be captured by the model. The illustration of random-LTD compared to baseline is shown in Figure 3 below, where random-LTD splits the input tokens into two groups and only the first group involves the compute.

Figure 3: Comparison between baseline, existing token dropping methods, and random-LTD. Note that for random-LTD, only part of the inputs (Group 1) is used for Layer i.

Random-LTD is simple yet very effective. Particularly, compared to other existing token dropping methods, random-LTD (1) does a purely random selection for each layer for two different groups, as such we do not require any expert design for the selection criterion; (2) is able to apply to all middle layers to achieve better saving ratio; (3) demonstrates great generalizability for both encoder and decoder models; and (4) is easy to use without much modeling change. These advantages enable maximum flexibility when applying random-LTD to various workloads.

Thanks to its great flexibility, we were able to apply random-LTD method to broader applications, including BERT and GPT pretraining as well as ViT and GPT finetuning tasks. For all cases, random-LTD achieves similar model quality as baseline while using less data, and/or achieve better model quality while using the same amount of data (Table 3 to 6). For GPT-3 and BERT-Large pretraining, random-LTD achieves 1.5-2x data saving while still maintaining the same model quality. For GPT-3 we also tested random-LTD with full data which further improves the model quality compared to baseline.

Table 3: GPT-3 1.3B pretraining data consumption and average evaluation accuracy on 19 tasks.

Table 4: BERT-Large pretraining data consumption and average GLUE finetuning score on 8 tasks.

Table 5: Finetuning result of ViT on ImageNet.

Table 6: GPT-2 350M finetuning result on the PTB task.

The curriculum learning and random-LTD techniques are complementary. Inside DeepSpeed Data Efficiency framework, we seamlessly compose the two techniques as shown in Figure 2 above, where curriculum learning helps to sample the next data batch and random-LTD helps to decide how to route each sampled data inside the model. DeepSpeed Data Efficiency solves several complexities when composing the two techniques so that users can easily apply each technique or both to their training pipeline. The composability of DeepSpeed Data Efficiency also applies to data sampling and routing techniques in general, so that it provides a platform to implement and compose additional data efficiency techniques.

The composed DeepSpeed Data Efficiency solution leverages both data efficiency techniques and achieves even better data and training efficiency. Take the GPT-3 pretraining task as an example, composing CL and random-LTD, with 100% data, leads to the best model quality in our experiments (Table 7 Case (1) to (4)). When pretraining with 50% data, the baseline training results in worse zero-shot and 10-shot evaluation accuracy, and using either CL or random-LTD can only recover part of the 10-shot accuracy loss. On the other hand, the composed data efficiency solution achieves the same or better accuracy results as baseline with 100% data, demonstrating a 2x data and 2x time saving (Case (5) to (8)). Similar benefit such as 2x data saving was also observed when applying our solution to BERT pretraining.

Table 7: GPT-3 1.3B pretraining data/time consumption and average evaluation accuracy on 19 tasks.

We are very excited to share DeepSpeed Data Efficiency library with the community and improve it with your feedback. Please find the code, tutorial, and documents at the DeepSpeed GitHub, and website. And for more technical details please read our Random-LTD paper and DeepSpeed Data Efficiency paper. We believe that our composable library and novel data efficiency techniques will help users reduce training cost while maintaining model quality or achieve better quality under similar cost. And we hope DeepSpeed Data Efficiency could become a platform that motivates and accelerates future research on deep learning data efficiency.

Updated: December 11, 2022

---

## DeepSpeed Inference: Multi-GPU inference with customized inference kernels and quantization support

**URL:** https://www.deepspeed.ai/2021/03/15/inference-kernel-optimization.html

**Contents:**
- DeepSpeed Inference: Multi-GPU inference with customized inference kernels and quantization support
    - Contents
- Multi-GPU Inference with Adaptive Parallelism
- Customized Inference Kernels for Boosted Compute Efficiency of Transformer Blocks
- Kernel-Fusion
- Seamless pipeline from training to inference with automatic kernel-injection
- Flexible quantization support
- Performance results

While DeepSpeed supports training advanced large-scale models, using these trained models in the desired application scenarios is still challenging due to three major limitations in existing inference solutions: 1) lack of support for multi-GPU inference to fit large models and meet latency requirements, 2) limited GPU kernel performance when running inference with small batch sizes, and 3) difficulties in exploiting quantization, which includes both quantizing the model to reduce the model size and latency as well as supporting high-performance inference of quantized models without specialized hardware.

To handle these challenges, we introduce DeepSpeed Inference, which seamlessly adds high-performance inference support to large models trained in DeepSpeed with three key features: inference-adapted parallelism for multi-GPU inference, inference-optimized kernels tuned for small batch sizes, and flexible support for quantize-aware training and inference kernels for quantized models.

Parallelism is an effective approach to fit large models and reduce per-device memory consumption for both training and inference. However, simply applying training parallelism choices and degree to inference does not work well. The MP and PP configuration is normally set during the model training, apart from the data parallelism (DP), based on the memory footprint and computation style, and resource budget. On one hand, inference computation intrinsically requires less memory, so it can afford a larger partition per device. It helps reduce the degree of parallelism needed for model deployment. On the other hand, optimizing latency or meeting latency requirements is often a first-class citizen in inference while training optimizes throughput.

To obtain desired latency, DeepSpeed Inference automatically adapts MP as an effective approach to reduce model latency, and its parallelism degree is often determined first. With MP, we can split the mode and parallelize computational operations across multiple devices (GPUs) to reduce latency, but it reduces computation granularity and increases communication that may hurt throughput. Once the latency target has been met, DeepSpeed can apply pipeline parallelism to maximize the throughput. Overall, DeepSpeed Inference supports flexible adaptation of both parallelism approach and degree choices from training to inference, minimizing latency while saving deployment costs.

To achieve high compute efficiency, DeepSpeed-inference offers inference kernels tailored for Transformer blocks through operator fusion, taking model-parallelism for multi-GPU into account. The main difference between our kernel-fusion scheme and similar approaches is that we not only fuse element-wise operations (such as bias-add, residual, and activation function), but also merge the General matrix multiply (GeMM) operations with other operations. To do this, we design an efficient implementation for the vector-matrix or skinny matrix-matrix multiplication that allows us to fuse more operations at the reduction boundary of GeMM operations.

We take two main policies for fusing operations: 1) keeping the access-pattern of inputs and outputs intact throughout the sequence of operations fused together; 2) fusing operations at each all-reduce boundary. The first policy ensures that different thread-blocks won’t encounter transferring data between Streaming-Multiprocessors (SMs). This is due to no straight-forward communication among SMs other than using the main memory which adds the block-synching overhead because of non-deterministic behavior of memory access. The reason behind the second policy is that we cannot continue the execution unless the partial results are reduced among the model-parallel GPUs.

Figure 1: Transformer Layer with Megatron-style model-parallelism all-reduce components. The figure illustrates the parts of layer fused together with broken lines (width of line shows the fusion depth).

Figure 1 shows the different components of a Transformer layer, and the groups of operations considered for fusion in our inference optimization. We also consider the NVIDIA Megatron-LM style of parallelism that partitions attention (Attn) and feed-forward (FF) blocks across multiple GPUs. Thus, we include the two all-reduce operations that reduce the results among parallel GPUs after Attn and FF blocks. As Figure 1 shows, we fuse the operations inside a Transformer layer at four main regions:

To fuse these operations, we exploit shared-memory as an intermediate cache for transferring data between reduction operations used in layer-norm and GeMM, and the element-wise operations. Moreover, we use the warp-level instructions to communicate data between threads when reducing partial computations. In addition, we use a new schedule for GeMM operations, which allows for fusing as many operations as needed for the third kernel-fusion. We also combine the GeMMs for the attention computation in the second kernel-fusion, by using an implicit matrix transformation in order to reduce the memory pressure. Compared to the unfused computation style using cuBLAS GeMM, we improve the performance by 1.5x, 2.9x. 3x, and 1.2x for all these kernel-fusions, respectively.

To run the model in Inference mode, DeepSpeed simply requires the location of the model checkpoints and the desired parallelism configuration, i.e., MP/PP degree. DeepSpeed Inference kernels can also be enabled for many well-known model architectures such as HuggingFace (Bert and GPT-2) or Megatron GPT-based models using a pre-defined policy map that maps the original parameters to the parameters in the inference kernels. For other transformer-based models, user can specify their own policy map. Note that DS-Inference can run independent of the training pipeline as long as it receives all model checkpoints, and the DeepSpeed Transformer kernels for inference can be injected into any Transformer model if the right mapping policy is defined. For more information on how to enable Transformer inference kernel as well as specifying parallelism, please refer to out inference tutorial.

To further reduce the inference cost for large-scale models, we created the DeepSpeed Quantization Toolkit, supporting flexible quantize-aware training and high-performance kernels for quantized inference.

For training, we introduce a novel approach called Mixture of Quantization (MoQ), which is inspired by mixed-precision training while seamlessly applying quantization. With MoQ, we can control the precision of the model by simulating the impact of quantization when updating the parameters at each step of training. Moreover, it supports flexible quantization policies and schedules—we find that by dynamically adjusting the number of quantization bits during training, the final quantized model provides higher accuracy under the same compression ratio. To adapt to different tasks, MoQ can also leverage the second order information of models to detect their sensitivity to precision and adjust the quantization schedule and target accordingly.

To maximize the performance gains from the quantization model, we provide inference kernels tailored for quantized models that reduce latency through optimizing data movement but do not require specialized hardware. Finally, our toolkit does not require any code changes on the client side, making it easy to use.

Boosting throughput and reducing inference cost. Figure 3 shows the inference throughput per GPU for the three model sizes corresponding to the three Transformer networks, GPT-2, Turing-NLG, and GPT-3. DeepSpeed Inference increases in per-GPU throughput by 2 to 4 times when using the same precision of FP16 as the baseline. By enabling quantization, we boost throughput further. We reach a throughput improvement of 3x for GPT-2, 5x for Turing-NLG, and 3x for a model that is similar in characteristics and size to GPT-3, which directly translates to 3–5x inference cost reduction on serving these large models. In addition, we achieve these throughput and cost improvements without compromising latency as shown in Figure 5.

Figure 3: Inference throughput for different model sizes. DeepSpeed Inference achieves 3x to 5x higher throughput than baseline.

One source of inference cost reduction is through reducing the number of GPUs for hosting large models as shown in Figure 4. The optimized GPU resources comes from 1) using inference-adapted parallelism, allowing users to adjust the model and pipeline parallelism degree from the trained model checkpoints, and 2) shrinking model memory footprint by half with INT8 quantization. As shown in this figure, we use 2x less GPUs to run inference for the 17B model size by adapting the parallelism. Together with INT8 quantization through DeepSpeed MoQ, we use 4x and 2x fewer GPUs for 17B and 175B sizes respectively.

Figure 4: Number of GPUs used for running inference on the different model sizes shown in Figure 4.

Reducing inference latency. For the application scenarios where inference latency is critical, we can increase model parallelism degree in DeepSpeed Inference to reduce inference latency further. As Figure 5 depicts, we can reduce the latency by 2.3x compared to PyTorch as we increase the model-parallelism size to 4. Furthermore, we can still have high latency improvement with a fewer number of GPUs by adapting the parallelism at inference and using MoQ to quantize the model. We obtain 1.3x and 1.9x speedups while using 4x and 2x lower resources than baseline, respectively.

For the application scenarios where inference latency is critical, we can increase model parallelism degree in DeepSpeed Inference to reduce inference latency further. As Figure 5 depicts, we can reduce the latency by 2.3x compared to PyTorch as we increase the model-parallelism size to 4. Furthermore, we can still have high latency improvement with a fewer number of GPUs by adapting the parallelism at inference and using MoQ to quantize the model. We obtain 1.3x and 1.9x speedups while using 4x and 2x lower resources than baseline, respectively.

Figure 5. Inference latency for the 17B model using different parallelism configuration to optimize latency.

Updated: March 15, 2021

---

## Inference Overview and Features

**URL:** https://www.deepspeed.ai/inference/

**Contents:**
- Inference Overview and Features
    - Contents

DeepSpeed-Inference v2 is here and it’s called DeepSpeed-FastGen! For the best performance, latest features, and newest model support please see our DeepSpeed-FastGen release blog!

DeepSpeed-Inference introduces several features to efficiently serve transformer-based PyTorch models. It supports model parallelism (MP) to fit large models that would otherwise not fit in GPU memory. Even for smaller models, MP can be used to reduce latency for inference. To further reduce latency and cost, we introduce inference-customized kernels. Finally, we propose a novel approach to quantize models, called MoQ, to both shrink the model and reduce the inference cost at production. For more details on the inference related optimizations in DeepSpeed, please refer to our blog post.

DeepSpeed provides a seamless inference mode for compatible transformer based models trained using DeepSpeed, Megatron, and HuggingFace, meaning that we don’t require any change on the modeling side such as exporting the model or creating a different checkpoint from your trained checkpoints. To run inference on multi-GPU for compatible models, provide the model parallelism degree and the checkpoint information or the model which is already loaded from a checkpoint, and DeepSpeed will do the rest. It will automatically partition the model as necessary, inject compatible high performance kernels into your model and manage the inter-gpu communication. For list of compatible models please see here.

To get started with DeepSpeed-Inference, please checkout our tutorial.

---

## Mixture-of-Quantization: A novel quantization approach for reducing model size with minimal accuracy impact

**URL:** https://www.deepspeed.ai/2021/05/04/MoQ.html

**Contents:**
- Mixture-of-Quantization: A novel quantization approach for reducing model size with minimal accuracy impact
    - Contents
- A unified suite for quantization-aware training and inference
- Quantization methodology
- Quantized Inference Kernels
- Ease of use
- Improving quantization accuracy.

Running large-scale models on multi-GPU might help reduce latency but increases the deployment cost significantly, especially as the model size grows bigger. To mitigate this issue, we resort to model compression techniques and introduce a new methodology that quantizes Transformer networks with a minimal impact on accuracy. Our technique achieves similar or better performance thanFP16 models through customized inference kernels on lower or equal number of GPUs.

Our scheme is flexible in the sense that it provides users the ability to experiment with any quantization configuration, such as the target number of bits used for quantization precision, and the scheduling by which the model gets quantized during training. Furthermore, we combine both the FP16 and quantized precision as a mixed-precision mechanism to smooth the transition from a high to low precision. Finally, we use the second-order gradient (eigenvalue) of the parameters to adjust the quantization schedule during training.

There are two main approaches of applying quantization: offline quantization on the trained model and quantization-aware training (QAT) that reduces the data-precision during training. Unlike the former scheme, QAT gets the model trained by taking the impact of precision loss into account during the training optimization. This will result in significant improvement of the quantized model accuracy. MoQ is designed on top QAT approach, with the difference that we use a mixture of precisions to train the model toward target quantization, as well as defining a scheduling for reducing the precision.

All existing QAT approaches quantize the model with a certain precision (number of bits) from the beginning of training until completion. However, even by using a relatively high quantization precision (8-bit), there will be some drop in model accuracy, which might not be acceptable for some downstream tasks. For instance, the Q8BERT work tries QAT for the BERT network, which results in good accuracy for some tasks while others (like SQuAD) lose 0.8% in the F1 score. Other techniques, such as Q-BERT, use grouped quantization with a large grouping size (128) when quantizing a parameter matrix to gain higher accuracy, but they are still inferior to the baseline.

Here, we present MoQ as a flexible solution for linear quantization that allows users to define a schedule as the model trains. Similar to iterative pruning to inject sparsity, we start quantization from a higher precision (16-bit quantization or FP16) and gradually reduce the quantization bits or the mixed-precision ratio for the FP16 part until reaching a target precision (8-bit). To control the precision transition, we define a hyperparameter, called quantization period, that indicates when the precision reduction should happen. We observe that by using such a schedule, we get the closest accuracy to the baseline. Note that in order to reach a certain precision, we need to define the starting bits and period in a way that within the number of samples to train, the model eventually gets quantized using the target number of bits. Please refer to the quantization tutorial for more information.

In order to dynamically adjust quantization precision, we employ eigenvalue as a metric that shows the sensitivity of training to the precision change. Eigenvalue has been previously used (Q-BERT) for quantization to choose the precision bits on different parts of the network. To combine this with MoQ, we cluster the eigenvalues into several regions based on their absolute values and tune the quantization period for each region accordingly, the higher the magnitude of eigenvalue, the larger the factor and the slower the precision decreases.

Figure 1. Quantization scheduling of one of the GLUE tasks (QNLI), using the eigenvalue of different layers. Different colors show the layers from 0 to 11 for Bert-Base.

Figure 1 shows the result of combining eigenvalue with MoQ for a 12-layer Bert Base model. As we see, the first few layers (0-4) tend to be more sensitive to reduced precision than the last layers, as their quantization period is an order of magnitude larger than the rest. Another observation from this figure is that the neighbor layers reduce the precision in the same way. For instance, layers 9, 10, and 11 on the left chart, and layers 0 and 4 and 1 and 3 on the right chart of Figure 1 get similar schedule. This is due to having similar eigenvalues for these layers throughout the training.

Figure 2: Mixed-precision quantization for the QNLI using target quantization period as 4 bits.

Figure 2 shows another mixed-precision quantization that sets target bits as 4, however the quantization period keeps updated through the eigenvalues of each layer. As we see, the end quantization bits are different for all layers. The first layers still get to 8-bit quantization as the training samples is not enough to decrease the quantization bits. On the other hand, the last layers keep reducing the precision. We finally reduce the average precision to 6 bits for the entire network while maintaining the accuracy of the model (0.3% drop in accuracy).

Figure 3: Mixed-precision quantization with MoQ for Bert SQuAD plus.

As another example, we use eigenvalue-based MoQ to quantize Bert-Large for SQuAD finetuning. Figure 3 shows the number of bits we get to at the end of finetuning on each layer. Here, we see slightly different precision spectrum compared to BertBase on GLUE tasks. As the figure shows, we can reduce the precision on the first few layers more aggressively than the middle ones. Also, the last few layers can tolerate very low precision similar to the beginning layers. This way of quantization finally results in 90.56 F1 Score which is pretty similar to the baseline.

By using other quantization methodologies, after the model is quantized, it can only have performance benefit if there is hardware support for integer-based operations. For this reason, the inputs and output of all GeMM operations need to be quantized. However, since the range of input may vary request by request, finding a range of data for each input at inference time is challenging. On the other hand, using a static range for all inputs can impact the inference accuracy.

To alleviate this problem, we introduce inference custom kernels that neither require the hardware support nor the input quantization. These kernels read quantized parameters and dequantize them on-the-fly and use the floating-point units of GPU cores for the GeMM operations. The main benefit of using these kernels is that they reduce the memory footprint required to load a model so that we can run inference on fewer number of GPUs, while improving the performance by saving the memory bandwidth required to run the inference on GPU.

Regarding the quantization implementation, we use different algorithms to quantize a value based on the range of data and the rounding policy. We support both symmetric and asymmetric quantization as the two mostly used schemes. We applied both techniques for QAT and see very similar results, however since symmetric approach is simpler to implement, we implement our inference kernels based on that. Regarding the rounding, we support stochastic rounding as another option besides the normal rounding. We have seen that for reducing the precision to as low as 4-bit or lower, stochastic rounding is more helpful as it has an unbiased random behavior during training.

For enabling quantization through Deepspeed, we only need to pass the scheduling through a JSON configuration file. To add the impact of quantization, we quantize and dequantize the parameters just before they are updated in the optimizer. Thus, we do not incur any change on the modeling side to quantize a model. Instead, we simulate the quantization impact by lowering the precision of data saved in FP16 format. By using this kind of implementation, we have the full flexibility of changing the precision using the training characteristics such as number of steps, and eigenvalue of the parameters and the original FP16 data format. As shown in this blog post, we can improve the quality of a quantized model by adaptively changing the scheduling of the quantization throughout training. For more information on how to use MoQ scheme, please look at our quantization tutorial.

To show how our quantization scheme preserves accuracy, we have experimented MoQ on several tasks and networks: GLUE tasks on Bert-Base and SQuAD on Bert-Large. Table 1 shows the accuracy results for the baseline without quantization (w/o Quant), basic quantization without using any scheduling during training (Basic Quant), and our MoQ scheme. Without using any scheduling, the accuracy for 8-bit quantization is often inferior to the baseline, and in this workload, it suffers from a drop of 1.02 point in accuracy (ACC). In contrast, MoQ powers 8-bit quantization to obtain comparable accuracy as the FP16 baseline, even with a slightly higher ACC, demonstrating the effectiveness of our quantization approach.

---

## DeepSpeed: Accelerating large-scale model inference and training via system optimizations and compression

**URL:** https://www.deepspeed.ai/2021/05/14/inference-release.html

**Contents:**
- DeepSpeed: Accelerating large-scale model inference and training via system optimizations and compression
    - Contents

Updated: May 14, 2021

---

## Autotuning: Automatically discover the optimal DeepSpeed configuration that delivers good training speed

**URL:** https://www.deepspeed.ai/2021/11/16/autotuning.html

**Contents:**
- Autotuning: Automatically discover the optimal DeepSpeed configuration that delivers good training speed

We introduce a new feature called Autotuning to automatically discover the optimal DeepSpeed configuration that delivers good training speed. One pain point in model training is to figure out good performance-relevant configurations such as micro-batch size to fully utilize the hardware and achieve a high throughput number. This configuration exploring process is commonly done manually but is important since model training is repeated many times and benefits from using a good configuration. Not only is the hand-tuning process time-consuming, but the outcome is hardware-dependent. This means that a good configuration on one hardware might not be the best on another different hardware. The user thus has to hand tune the configuration again. With DeepSpeed, there are more configuration parameters that could potentially affect the training speed, thus making it more tedious to manually tune the configuration.

The DeepSpeed Autotuner mitigates this pain point and automatically discovers the optimal DeepSpeed configuration that delivers good training speed. It not only reduces the time and resources users spend on tuning, but also can discover configurations better than hand-tuned methods. DeepSpeedExamples would demonstrate the effectiveness of autotuning across different models.

Updated: November 16, 2021

---

## Contributing

**URL:** https://www.deepspeed.ai/contributing/

**Contents:**
- Contributing
    - Contents
- Prerequisites
- Testing
  - Unit Tests
  - Model Tests
- Contributor License Agreement
- Code of Conduct

DeepSpeed welcomes your contributions!

DeepSpeed uses pre-commit to ensure that formatting is consistent across DeepSpeed. First, ensure that pre-commit is installed from either installing DeepSpeed or pip install pre-commit. Next, the pre-commit hooks must be installed once before commits can be made:

Afterwards, our suite of formatting tests run automatically before each git commit. You can also run these manually:

If a formatting test fails, it will fix the modified code in place and abort the git commit. After looking over the changes, you can git add <modified files> and then repeat the previous git commit command.

DeepSpeed tracks two types of tests: unit tests and more costly model convergence tests. The model convergence tests train DeepSpeedExamples and measure end-to-end convergence and related metrics. Unit tests are found in tests/unit/ and the model convergence tests are found in tests/model/.

PyTest is used to execute tests. PyTest can be installed from PyPI via pip install pytest. Simply invoke pytest --forked to run the unit tests:

You can also provide the -v flag to pytest to see additional information about the tests. Note that pytest-forked and the --forked flag are required to test CUDA functionality in distributed tests.

Model tests require four GPUs and training data downloaded for DeepSpeedExamples.

To execute model tests, first install DeepSpeed. The DeepSpeedExamples repository is cloned as part of this process. Next, execute the model test driver:

Note that the --forked flag is not necessary for the model tests.

This project welcomes contributions and suggestions. Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the Microsoft Open Source Code of Conduct. For more information see the Code of Conduct FAQ or contact opencode@microsoft.com with any additional questions or comments.

**Examples:**

Example 1 (unknown):
```unknown
pre-commit install
```

Example 2 (unknown):
```unknown
pre-commit run --all-files
```

Example 3 (unknown):
```unknown
pytest --forked tests/unit/
```

Example 4 (unknown):
```unknown
cd tests/model/
pytest run_sanity_check.py
```

---

## Latest News

**URL:** https://www.deepspeed.ai

**Contents:**
- Latest News
    - Contents
- Extreme Speed and Scale for DL Training
- DeepSpeed Adoption
- Contributing
- Contributor License Agreement
- Code of Conduct
- Publications
- Videos

[2025/10] SuperOffload: Unleashing the Power of Large-Scale LLM Training on Superchips

[2025/10] Study of ZenFlow and ZeRO offload performance with DeepSpeed CPU core binding

[2025/08] ZenFlow: Stall-Free Offloading Engine for LLM Training

[2025/06] Arctic Long Sequence Training (ALST) with DeepSpeed: Scalable And Efficient Training For Multi-Million Token Sequences

[2025/06] DeepNVMe: Affordable I/O scaling for Deep Learning Applications

DeepSpeed enabled the world’s most powerful language models (at the time of this writing) such as MT-530B and BLOOM. DeepSpeed offers a confluence of system innovations, that has made large scale DL training effective, and efficient, greatly improved ease of use, and redefined the DL training landscape in terms of scale that is possible. These innovations include ZeRO, 3D-Parallelism, DeepSpeed-MoE, ZeRO-Infinity, etc.

DeepSpeed has been used to train many different large-scale models. Below is a list of several examples that we are aware of (if you’d like to include your model please submit a PR):

DeepSpeed has been integrated with several different popular open-source DL frameworks such as:

DeepSpeed is an integral part of Microsoft’s AI at Scale initiative to enable next-generation AI capabilities at scale.

DeepSpeed welcomes your contributions! Please see our contributing guide for more details on formatting, testing, etc.

This project welcomes contributions and suggestions. Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the Microsoft Open Source Code of Conduct. For more information see the Code of Conduct FAQ or contact opencode@microsoft.com with any additional questions or comments.

Xinyu Lian, Sam Ade Jacobs, Lev Kurilenko, Masahiro Tanaka, Stas Bekman, Olatunji Ruwase, Minjia Zhang. (2024) Universal Checkpointing: Efficient and Flexible Checkpointing for Large Scale Distributed Training arXiv:2406.18820

---
