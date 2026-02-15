# Deepspeed - 2020

**Pages:** 16

---

## DeepSpeed Microsoft Research Webinar is now on-demand

**URL:** https://www.deepspeed.ai/2020/08/06/webinar-on-demand.html

**Contents:**
- DeepSpeed Microsoft Research Webinar is now on-demand
    - Contents

Updated: August 6, 2020

---

## An Order-of-Magnitude Larger and Faster Training with ZeRO-2

**URL:** https://www.deepspeed.ai/2020/05/18/zero-stage2.html

**Contents:**
- An Order-of-Magnitude Larger and Faster Training with ZeRO-2

ZeRO-2 expands the scope of memory optimizations in the original ZeRO by tackling the full spectrum of memory consumption during training. More specifically, ZeRO-2 introduces new technology to reduce the memory footprint of gradients, activation memory, and fragmented memory, in addition to optimizer state memory optimization in the original ZeRO. Altogether, the memory savings empower DeepSpeed to improve the scale and speed of deep learning training by an order of magnitude. More concretely, ZeRO-2 allows training models as large as 170 billion parameters up to 10x faster compared to state of the art.

For more information on ZeRO-2, see our blog post.

For more information on how to use ZeRO-2, see an example of training GPT family of models in this tutorial.

For a technical overview, see our technical report.

Updated: May 18, 2020

---

## 10x bigger model training on a single GPU with ZeRO-Offload

**URL:** https://www.deepspeed.ai/2020/09/08/ZeRO-Offload.html

**Contents:**
- 10x bigger model training on a single GPU with ZeRO-Offload

We introduce a new technology called ZeRO-Offload to enable 10X bigger model training on a single GPU. ZeRO-Offload extends ZeRO-2 to leverage both CPU and GPU memory for training large models. Using a machine with a single GPU, our users now can run models of up to 13 billion parameters without running out of memory, 10x bigger than the existing approaches, while obtaining competitive throughput. This feature democratizes multi-billion-parameter model training and opens the window for many deep learning practitioners to explore bigger and better models.

Updated: September 8, 2020

---

## Progressive Layer Dropping

**URL:** https://www.deepspeed.ai/2020/10/28/progressive-layer-dropping-news.html

**Contents:**
- Progressive Layer Dropping

We introduce a new technology called progressive layer dropping (PLD) to speedup the pre-training of Transformer-based networks through efficient and robust compressed training. The pre-training step of Transformer networks often suffer from unbearable overall computational expenses. We analyze the training dynamics and stability of Transformer networks and propose PLD to sparsely update Transformer blocks following a progressive dropping schedule, which smoothly increases the layer dropping rate for each mini-batch as training evolves along both the temporal and the model depth dimension. PLD is able to allow the pre-training to be 2.5X faster to get similar accuracy on downstream tasks and allows the training to be 24% faster when training the same number of samples, not at the cost of excessive hardware resources.

Updated: October 28, 2020

---

## ZeRO-2 & DeepSpeed: Shattering Barriers of Deep Learning Speed & Scale

**URL:** https://www.deepspeed.ai/2020/05/18/press-release.html

**Contents:**
- ZeRO-2 & DeepSpeed: Shattering Barriers of Deep Learning Speed & Scale
    - Contents

Updated: May 18, 2020

---

## ZeRO stage 1 with reduced communication

**URL:** https://www.deepspeed.ai/2020/03/17/reduce-scatter.html

**Contents:**
- ZeRO stage 1 with reduced communication
    - Contents
- Further updates coming soon!

Updated: March 17, 2020

---

## Powering 10x longer sequences and 6x faster execution through DeepSpeed Sparse Attention

**URL:** https://www.deepspeed.ai/2020/09/08/sparse-attention-news.html

**Contents:**
- Powering 10x longer sequences and 6x faster execution through DeepSpeed Sparse Attention

DeepSpeed offers sparse attention kernels, an instrumental technology to support long sequences of model inputs, whether for text, image, or sound. Compared with the classic dense Transformers, it powers an order-of-magnitude longer input sequence and obtains up to 6x faster execution with comparable accuracy. It also outperforms state-of-the-art sparse implementations with 1.5-3x faster execution. Furthermore, our sparse kernels support efficient execution of flexible sparse format and empower users to innovate on their custom sparse structures.

Updated: September 8, 2020

---

## ZeRO & DeepSpeed: New system optimizations enable training models with over 100 billion parameters

**URL:** https://www.deepspeed.ai/2020/02/13/release.html

**Contents:**
- ZeRO & DeepSpeed: New system optimizations enable training models with over 100 billion parameters
    - Contents

Updated: February 13, 2020

---

## Microsoft DeepSpeed achieves the fastest BERT training time

**URL:** https://www.deepspeed.ai/2020/05/27/fastest-bert-training.html

**Contents:**
- Microsoft DeepSpeed achieves the fastest BERT training time
    - Contents
- Performance Results for BERT Pretraining
- Performance Results for Fine-Tuning Tasks
- BERT Highly Optimized Transformer Kernels
  - (a) Advanced fused kernels to reduce data movement
  - (b) Invertible operators to save memory and run large batches
- Overlapping I/O with Computation through Asynchronous Prefetching Queue
- Exploiting Sparsity of BERT’s Output Processing
- Pre-LayerNorm vs Post-LayerNorm Architecture

Good news! DeepSpeed obtains the fastest BERT training record: 44 minutes on 1024 NVIDIA V100 GPU. This is a 30% improvement over the best published result of 67 mins in end-to-end training time to achieve the same accuracy on the same number and generation of GPUs. This improvement does not come at the cost of excessive hardware resources but comes from improved software efficiency. For example, DeepSpeed can attain a staggering 64 teraflops of single GPU performance on a NVIDIA V100 GPU which is over 50% of the hardware peak.

In this blog post, we will discuss four technological improvements that enable DeepSpeed to achieve this record-breaking BERT training time.

These optimizations not only benefit BERT; they are also applicable to many other transformer-based models such as RoBERTa, XLNet, and UniLM. Furthermore, besides the improvements mentioned for pre-training, DeepSpeed achieves up to 1.5x speedups for the downstream tasks, such as the fine-tuning for Bing-BERT SQuAD.

Compared to SOTA, DeepSpeed significantly improves single GPU performance for transformer-based model like BERT. Figure 1 shows the single GPU throughput of training BERT-Large optimized through DeepSpeed, comparing with the two well-known PyTorch implementations from NVIDIA BERT and Hugging Face BERT. DeepSpeed reaches as high as 64 and 53 teraflops throughputs (corresponding to 272 and 52 samples/second) for sequence lengths 128 and 512, respectively, exhibiting up to 28% throughput improvements over NVIDIA BERT and up to 62% over HuggingFace BERT. We also support up to 1.8x larger batch size without running out of memory.

To achieve this performance, DeepSpeed implements a stochastic transformer which exhibits some level of non-deterministic noise without affecting overall convergence. In addition, DeepSpeed also implements a deterministic transformer kernel that is completely reproducible at the expense of a small performance regression of approximately 2% on average. Users can easily choose and switch between the two versions depending on their usage scenarios: Stochastic version pursues ultimate training performance goal, and deterministic version may save development time by better facilitating experimentation and debugging. We report performance numbers for both these kernels in Figure 1. The performance numbers were collected with a gradient accumulation step of 10 for all batch sizes and configurations, since on average an overall batch size used in practical scenarios range from a few hundred to a few thousand.

Figure 1: Performance evaluation of BERT-Large on a single V100 GPU, comparing DeepSpeed with NVIDIA and HuggingFace versions of BERT in mixed-sequence length training. The labeled points show the highest throughput of each implementation in teraflops (Tflops). DeepSpeed boosts throughput and allows for higher batch sizes without running out-of-memory.

Looking at distributed training across GPUs, Table 1 shows our end-to-end BERT-Large pre-training time (F1 score of 90.5 for SQUAD) using 16 to 1024 GPUs. We complete BERT pre-training in 44 minutes using 1024 V100 GPUs (64 NVIDIA DGX-2 nodes). In comparison, the previous SOTA from NVIDIA takes 47 mins using 1472 V100 GPUs. DeepSpeed is not only faster but also uses 30% less resources. Using the same 1024 GPUS,NVIDIA BERT takes 67 minutes using the same 1024 GPUs [1] BERT, whereas DeepSpeed takes 44 minutes, reducing training time by 30%. Similarly, on 256 GPUs, NVIDIA BERT takes 236 minutes while DeepSpeed takes 144 minutes (39% faster).

Table 1: BERT-Large training time using 1 to 64 DGX-2’s with DeepSpeed.

At the recent GTC 2020, NVIDIA announced the next generation hardware A100, which now offers 2.5X hardware peak performance over the V100 GPU. Assuming the A100 GPU allows us to obtain the same percentage of hardware peak performance (50%) as we obtained on V100 GPUs, we expect to obtain even higher throughput by combining our software optimizations with the new hardware. We project it would reduce BERT training time further to less than 25 minutes on a cluster of 1024 A100 GPUs.

In addition to the performance benefits we show for the pre-training, we have evaluated the performance of our customized kernel for fine-tuning the downstream tasks. Tables 2 and 3 show the samples-per-second achieved when running Bing-BERT SQuAD on NVIDIA V100 using 16 and 32 GB of memory, using PyTorch and DeepSpeed transformer kernels. For the 16-GB V100, we can achieve up to 1.5x speedup while supporting 2x larger batch size per GPU. On the other hand, we can support as large as 32 batch size (2.6x more than Pytorch) using 32GB of memory, while providing 1.3x speedup for the end-to-end fine-tune training. Note, that we use the best samples-per-second to compute speedup for the cases that PyTorch runs out-of-memory (OOM).

Table 2. Samples/second for running SQuAD fine-tuning on NVIDIA V100 (16-GB) using PyTorch and DeepSpeed transformer kernels.

Table 3: Samples/second for running SQuAD fine-tuning on NVIDIA V100 (32-GB) using PyTorch and DeepSpeed transformer kernels.

GPUs have very high peak floating-point throughput, but the default Transformer blocks in most framework implementations are far from reaching this peak. Figure 2 shows the structure of a Transformer block with the LayerNorm placed on the input stream of the two sublayers: Attention and Feed-Forward. To approach the GPU peak performance, we employ two lines of optimizations in our own Transformer kernel implementation: advanced fusion, and invertible operators.

Figure 2: Transformer Layer with Pre-LayerNorm Architecture

We observe that transformer-based networks trigger many invocations of CUDA kernels operating in a producer-consumer fashion, adding a lot of cost for transferring data to and from global memory and overhead from kernel launching. Existing compiler-based approaches perform fine-grained fusion (e.g., fusion of element-wise operations), leading to missed fusion opportunities. In contrast, we fully exploit both fine-grain and coarse-grained fusion, tailored for Transformer blocks.

QKV and various fusions. We merge the three Query (Q), Key (K), and Value (V) weight matrices to dispatch a larger QKV GEMM to expose more parallelism and improve data locality on GPU’s shared memory and register files, as shown in Figure 3. Next, we combine the data-layout transformation of the QKV’s output matrix with the bias addition. We then partition the large QKV matrix into three transformed ones, used for the following self-attention computation.

As Figure 3 illustrates, we read the QKV matrix in consecutive rows (shown by red box), and write them in the three transformed Q, K, and V matrices. Since each matrix starts from a different offset, we may have uncoalesced access to the main memory. Thus, we use the shared memory as an intermediate buffer, in order to rearrange the data in a way that we can put the data in consecutive parts of memory. Even though we produce an uncoalesced pattern when accessing shared memory, we reduce the cost of uncoalesced access to main memory to better exploit memory bandwidth, resulting in 3% to 5% performance improvement in the end-to-end training.

Figure 3: QKV’s GEMM and transform Kernel-Fusion

We perform additional fusions such as merging the addition of bias from the attention-output GEMM with the addition from the residual connection and also dropout, which allows accesses to happen in the register files and shared memory, which are orders of magnitude faster than the expensive write-back to the global memory.

Warp-level communication. To alleviate the synchronization overhead among parallel GPU cores and further increase the resource utilization of the fused kernels, we use the warp-level (data shuffle instructions) instead of the default inter-warp communication. Take the layer-normalization and SoftMax kernel as examples, we perform each reduction operation inside a warp, while distributing different reductions across different warps. This way, we alleviate the synchronization among the parallel threads and further increase the GPU resource utilization.

Stochastic vs deterministic kernels. DL training is generally robust to some level of stochasticity, and in some cases, controlled noises such as dropouts act as regularizer which improve generalization. In designing our transformer kernel, we embrace some level of stochasticity to improve throughput by allowing for limited data race conditions to exist in the kernel: We leverage implicit warp synchronous programming to achieve higher performance for the warp-level cooperative operations [3]. The lack of explicit warp level synchronization act as non-deterministic noise without affecting the overall convergence behavior of the transformer kernels while giving a decent throughput boost.

In addition, DeepSpeed also implements a non-stochastic transformer kernel with explicit warp synchronization that produces deterministic results at the expense of a small performance regression. Users can easily choose and switch between the two versions depending on their usage scenarios: Stochastic version pursues ultimate training performance goal, and deterministic version may save development time by better facilitating experimentation and debugging.

In our experiments, we use stochastic kernels for the pre-training BERT, while using non-stochastic kernels for fine-tuning to achieve fully reproducible results. We recommend using stochastic kernels for training tasks involving massive amounts of data such as pre-training, while using non-stochastic version when training with limited data such as in the case of fine-tuning for more consistent results.

Cost-effective rematerialization. When fusing kernels of the different operations, we observe that some operators are inexpressive to compute but incur expensive data movement cost, such as addition of bias and dropout. For these operations, we avoid saving their results in the forward pass, but instead recompute them during the backward pass, which turns out to be much faster than having their results written and reloaded from the main memory.

We also observe that the intermediate activations from several operators in the Transformer blocks incur a large memory consumption, such as SoftMax and Layer Norm. For these operators, we drop the inputs to these layers to reduce the footprint of activation memory, by leveraging the fact that they are invertible functions, which are functions whose backward pass is independent of the inputs and can be formulated based only on the outputs [2]. Figure 4 and Figure 5 show the examples of the original implementation of SoftMax and Layer-Norm in PyTorch versus the invertible SoftMax implementation in DeepSpeed. Through this optimization, we are able to reduce the activation memory of the operator by half, and the reduced memory allows us to train with larger batch sizes, which once again improves GPU efficiency.

Figure 4: DeepSpeed invertible SoftMax operation versus Default PyTorch SoftMax operation

Figure 5: DeepSpeed invertible LayerNorm operation versus Default PyTorch LayerNorm operation

Beyond highly optimized transformer kernels, the BERT training has other performance limiting factors, e.g., data loading. We develop our own asynchronous worker which prefetches batches of data into a queue only at “safe points” – points when the CPUs are idle (e.g., right after asynchronously launching the forward pass). In this way, we make sure that there is no dequeuing and copying data from CPU to GPU when there is computation on the CPU side. This is different from the default PyTorch data loader, which can prefetch data at any points and cause performance interference. By using this method, we hide almost all I/O overhead, which accounts for 4% of the original training time.

We improve the end-to-end training time by 5.4% by recognizing and exploiting sparsity in BERT’s output processing. The output processing involves two steps: i) BERT projection from the hidden output dimension of the final transformer layer to the language vocabulary, using a matrix-matrix multiplication, and ii) a cross-entropy of the masked output tokens to the get each sequence’s prediction error. The cost of the first step is proportional to the vocabulary size, hidden output dimension and the sequence length, and can be as expensive as a transformer layer computation or more. However, only about 15% of the tokens are masked, and we only need the cross-entropy for the masked tokens. Therefore, the projection can be done as an efficient sparse computation. To do so, we discard the rows of the final transformer layer that corresponding to the non-masked tokens before doing the projection, reducing the computation cost of output processing by 85%.

We observe that with large batch size (e.g., 64K) the default BERT pre-training suffers from training instability, which can result in model divergence or convergence to bad/suspicious local optima. Further investigation shows that the default BERT has vanishing gradients issue. To mitigate the issue, we changed the placement of LayerNorm (Post-LayerNorm) by placing it only on the input stream of the sublayers in the Transformer block (called Pre-LayerNorm), a modification described by several recent works for neural machine translation. The Pre-LayerNorm results in several useful characteristics such as avoiding vanishing gradient, stable optimization, and performance gain. It allows us to train at aggregated batch size of 64K with increased learning rate and faster convergence.

To try out these optimizations and training recipe, please check out our BERT training tutorial and source code at the DeepSpeed GitHub repo.

[1] “NVIDIA Clocks World’s Fastest BERT Training Time and Largest Transformer Based Model, Paving Path For Advanced Conversational AI” https://devblogs.nvidia.com/training-bert-with-gpus/.

[2] S. R. Bulo, L. Porzi, and P. Kontschieder, “In-place activated batch norm for memory-optimized training of dnns” 2017. http://arxiv.org/abs/1712.02616.

[3] Mark Harris and Kyrylo Perelygin, “Cooperative Groups: Flexible CUDA Thread Programming”, https://devblogs.nvidia.com/cooperative-groups/.

Updated: May 27, 2020

---

## Training a Trillion Parameters with Pipeline Parallelism

**URL:** https://www.deepspeed.ai/2020/09/08/pipeline-parallelism.html

**Contents:**
- Training a Trillion Parameters with Pipeline Parallelism
    - Contents

DeepSpeed includes new support for pipeline parallelism! DeepSpeed’s training engine provides hybrid 3D parallelism for training models with over a trillion parameters. In addition to scaling to the extreme, we have demonstrated that hybrid parallelism accelerates training on clusters with low-bandwidth network by up to 7x.

Updated: September 8, 2020

---

## Turing-NLG: A 17-billion-parameter language model by Microsoft

**URL:** https://www.deepspeed.ai/2020/02/13/turing-nlg.html

**Contents:**
- Turing-NLG: A 17-billion-parameter language model by Microsoft
    - Contents

Updated: February 13, 2020

---

## Up to 5x less communication and 3.4x faster training through 1-bit Adam

**URL:** https://www.deepspeed.ai/2020/09/08/onebit-adam-news.html

**Contents:**
- Up to 5x less communication and 3.4x faster training through 1-bit Adam

Adam is an effective and probably the most well-utilized optimizer for training many large-scale deep learning models. However, Adam is generally not compatible with communication-efficient optimization algorithms, and therefore the communication cost could become a bottleneck while scaling across distributed devices. We introduce a new algorithm - 1-bit Adam - and its efficient implementation in DeepSpeed. 1-bit Adam offers the same convergence as Adam, incurs up to 5x less communication that enables up to 3.5x higher throughput for BERT-Large pretraining and up to 2.7x higher throughput for SQuAD fine-tuning on bandwidth-limited clusters.

Updated: September 8, 2020

---

## DeepSpeed Sparse Attention

**URL:** https://www.deepspeed.ai/2020/09/08/sparse-attention.html

**Contents:**
- DeepSpeed Sparse Attention
    - Contents
- Performance Results

Attention-based deep learning models such as the transformers are highly effective in capturing the relationship between tokens in an input sequence, even across long distances. As a result, they are used with text, image, and sound-based inputs, where the sequence length can be in thousands of tokens. However, despite the effectiveness of attention modules to capture long term dependencies, in practice, their application to long sequence input is limited by compute and memory requirements of the attention computation that grow quadratically, O(n^2), with the sequence length n.

To address this limitation, DeepSpeed offers a suite of sparse attention kernels –an instrumental technology that can reduce the compute and memory requirement of attention computation by orders-of-magnitude via block-sparse computation. The suite not only alleviates the memory bottleneck of attention calculation, but also performs sparse computation efficiently. Its APIs allow convenient integration with any transformer-based models. Along with providing a wide spectrum of sparsity structures, it has the flexibility of handling any user-defined block-sparse structures. More specifically, sparse attention (SA) can be designed to compute local attention between nearby tokens, or global attention via summary tokens computed with local attention. Moreover, SA can also allow random attention, or any combination of local, global, and random attention as shown in the following figure with blue, orange, and green blocks, respectively. As a result, SA decreases the memory footprint to O(wn), in which 1 < w < n is a parameter, whose value depends on the attention structure.

This library is PyTorch based and develops required kernels through Triton platform; kernels are not written in CUDA, which leaves the door open for CPU/OpenCL/Vulkan support in the future. The library is an extension to DeepSpeed and can be used through DeepSpeed as well as stand alone. Block-sparse computations handled by DeepSpeed Sparse Attention kernels are illustrated in following figures for forward and backward passes respectively. In the figures, S stands for a block-sparse matrix and D a dense matrix.

To learn more about Sparsity Config, and also how to use this library, please check our tutorial that provides detailed information about it.

We also define a template to have variable structure (top figure), which can be used to simply customize any block-sparse random/local/global attention pattern. In addition to this list, user can add any other sparsity structure as described in tutorial section.

Updated: September 8, 2020

---

## The Fastest and Most Efficient BERT Training through Optimized Transformer Kernels

**URL:** https://www.deepspeed.ai/2020/05/18/bert-record.html

**Contents:**
- The Fastest and Most Efficient BERT Training through Optimized Transformer Kernels

We introduce new technology to accelerate single GPU performance via kernel optimizations. These optimizations not only create a strong foundation for scaling out large models, but also improve the single GPU performance of highly tuned and moderately sized models like BERT by more than 30%, reaching a staggering performance of 66 teraflops per V100 GPU, which is 52% of the hardware peak. Using optimized transformer kernels as the building block, DeepSpeed achieves the fastest BERT training record: 44 minutes on 1,024 NVIDIA V100 GPUs, compared with the best published result of 67 minutes on the same number and generation of GPUs.

Updated: May 18, 2020

---

## DeepSpeed Microsoft Research Webinar on August 6th, 2020

**URL:** https://www.deepspeed.ai/2020/07/23/deepspeed-webinar.html

**Contents:**
- DeepSpeed Microsoft Research Webinar on August 6th, 2020
    - Contents

Updated: July 23, 2020

---

## DeepSpeed with 1-bit Adam: 5x less communication and 3.4x faster training

**URL:** https://www.deepspeed.ai/2020/09/08/onebit-adam-blog-post.html

**Contents:**
- DeepSpeed with 1-bit Adam: 5x less communication and 3.4x faster training
    - Contents
- 1. Introduction
  - 1.1 Background: Classic compression techniques
  - 1.2 Challenges in applying error-compensation to Adam
- 2. Compressing communication with 1-bit Adam
  - 2.1 How 1-bit Adam works under the hood
  - 2.2 Addressing system challenges for 1-bit Adam
- 3. Benefits of 1-bit Adam on communication-constrained systems
- 4. Dive deeper into 1-bit Adam evaluation results

Scalable training of large models (like BERT and GPT-3) requires careful optimization rooted in model design, architecture, and system capabilities. From a system standpoint, communication has become a major bottleneck, especially on commodity systems with standard TCP interconnects that offer limited network bandwidth. Communication compression is an important technique to reduce training time on such systems. One of the most effective ways to compress communication is via error compensation compression, which offers robust convergence speed, even under 1-bit compression. However, state-of-the-art error compensation techniques only work with basic optimizers like Stochastic Gradient Descent (SGD) and momentum SGD, which are linearly dependent on the gradients. They do not work with non-linear gradient-based optimizers like Adam, which offers state-of-the-art convergence efficiency and accuracy for many tasks, including training of BERT-like models. For a powerful optimizer like ADAM, the non-linear dependency on gradient (in the variance term) makes it challenging to develop error compensation-based compression techniques, limiting the practical value of the state-of-the-art communication compression techniques.

One way of communication compression is 1-bit compression, which can be expressed as:

With this compression, we could achieve a 32x reduction of memory size by representing each number using one bit. The problem is that using this straightforward method would significantly degrade the convergence speed, which makes this method inapplicable. To solve this problem, recent studies show that by using error compensation compression, we could expect almost the same convergence rate with communication compression. The idea of error compensation can be summarized as: 1) doing compression, 2) memorizing the compression error, and then 3) adding the compression error back in during the next iteration. For SGD, doing error compression leads to:

Where C(⋅) is the 1-bit compression operator. The good thing about doing this error compensation is that the history compression error (e_t and e_(t-1)) would be canceled by itself eventually, which can be seen by:

This strategy has been proven to work for optimization algorithms that are linearly dependent on the gradient, such as SGD and Momentum SGD.

We provide an overview of the Adam algorithm below. The update rules are as follows.

As shown in the equations above, the variance term v_t is nonlinearly dependent on the gradient g_t. If we apply basic error compensation compression to Adam, we observe that Adam will not converge as shown in Figure 1.

Figure 1: Inapplicability of Error-compensation Compression for Adam due to non-linear dependence on the gradient

To compress communication while using the Adam optimizer, we develop 1-bit Adam, which addresses the non-linearity in gradients via preconditioning. We observe that the magnitude of changes on the non-linear term, variance ( v_t), decrease significantly after a few epochs of training and setting v_t constant afterwards will not change the convergence speed. The proposed 1-bit Adam optimizer, as shown in Figure 2, consists of two parts: the warmup stage, which is essentially the vanilla Adam algorithm; and the compression stage, which keeps the variance term constant and compresses the remaining linear term, that is the momentum, into 1-bit representation.

The compression stage of the algorithm is controlled by a threshold parameter (as shown in Figure 2). When we detect that the change in “variance” falls below a certain threshold, we switch to the compression stage. Our study shows that only 15-20% of the overall training steps are needed for the warmup stage.

Figure 2: Comparison of distributed training steps in classic Adam and the proposed 1-bit compressed Adam algorithm

The weight update rule for 1-bit Adam is governed by the following equations.

For the i-th worker, in the compression stage:

Where x_t is the model after iteration (t-1), m_t^(i), e_t^(i) are the momentum and compression error on worker i after iteration (t-1), and v_warmup is the variance term after the warmup stage.

Besides the algorithmic challenge, there are two system challenges in applying 1-bit Adam in training systems. First, we need efficient kernels that convert the momentum to 1-bit representations. Second, we need efficient communication schemes to exchange this compressed momentum across different GPUs. The goal of compression is to reduce the overall training time so that commodity systems with bandwidth-limited interconnects can be used to train large models. We address these challenges in DeepSpeed and introduce a fully optimized 1-bit Adam implementation for training on communication-constrained systems.

1-bit Adam offers the same convergence as Adam, incurs up to 5x less communication that enables up to 3.5x higher throughput for BERT-Large pretraining and up to 2.7x higher throughput for SQuAD fine-tuning. This end-to-end throughput improvement is enabled by the 6.6x (Figure 3) and 6.2x (Figure 4) speedup observed during the compression stage. It is worth mentioning that our 1-bit Adam optimizer scales so well on a 40 Gigabit Ethernet system that its performance is comparable to Adam’s scalability on a 40 Gigabit InfiniBand QDR system. We note that the effective bandwidth on 40 Gigabit Ethernet is 4.1 Gbps based on iperf benchmarks whereas InfiniBand provides near-peak bandwidth of 32Gbps based on InfiniBand perftest microbenchmarks.

Figure 3: Scalability of 1-bit Adam for BERT-Large Pretraining on V100 GPUs with batch size of 16/GPU.

Figure 4: Scalability of 1-bit Adam for SQuAD Finetuning on V100 GPUs with batch size of 3/GPU.

One major question for using 1-bit Adam is the convergence speed, and we find that 1-bit Adam can achieve the same convergence speed and comparable testing performance using the same number of training samples as shown in Figure 5.

Figure 5: 1-bit Adam converges like Adam using the same number of training samples.

Detailed BERT-Base and BERT-Large results are shown in Table 1. We see that the scores are on par with or better than the original model for both the uncompressed and compressed cases.

Table 1: Verifying correctness of 1-bit Adam on various testing tasks

Up to 5x less communication: 1-bit Adam provides the same convergence as Adam and reduces the communication volume by 16x during the compression stage for 16-bit (FP16) training. For BERT pretraining, this leads to an overall communication reduction of 5x as we observed the warmup stage to be just 15% of the end-to-end training time.

The formula to calculate the communication volume ratio of the original versus 1-bit Adam is as follows:

In the case of warmup equaling 15%, original Adam incurs 5x of the communication as 1-bit Adam.

We present two main results for training BERT-Large on systems with two different bandwidth-limited interconnects: 1) 40 gigabit Ethernet (Figure 5) and 2) 40 gbps InfiniBand QDR (Figure 6). During the compression phase, we observe up to 6.6x higher throughput on the system with Ethernet and up to 2x higher throughput on the system with InfiniBand, resulting in end-to-end speed up (including both warmup and compression stages) of 3.5x and 2.7x, respectively. The major benefit of 1-bit Adam comes from the communication volume reduction—enabled by our compressed momentum exchange—and from our custom allreduce operation that implements efficient 1-bit communication using non-blocking gather operations followed by an allgather operation.

It is important to note that one can also increase total batch size to reduce communication using optimizers like LAMB instead of Adam for BERT pretraining. However, 1-bit Adam avoids the need for rigorous hyperparameter tuning, which is often more difficult for large batches from our experience. Furthermore, 1-bit Adam also works very well for workloads that have small critical batch size (cannot converge well with large batch size) like many fine-tuning tasks.

Figure 5: Performance of 1-bit Adam for BERT-Large training on 40 Gbps Ethernet interconnect during the compression stage.

Figure 6: Performance of 1-bit Adam for BERT-Large training on 40 Gbps InfiniBand interconnect during the compression stage.

1-bit Adam offers scalability not only on large-scale training tasks but also on tasks like SQuAD fine-tuning. As shown in Figures 7 and 8, 1-bit Adam scales well on both Ethernet- and InfiniBand-based systems and offers up to 6.2x higher throughput (during the compression stage) on the Ethernet-based system, resulting in 2.7x end-to-end speedup (25% warmup plus 75% compression stage). For SQuAD fine-tuning, we observed that a total batch size of 96 offers the best F1 score. Batch sizes larger than this value lower the convergence rate and require additional hyperparameter tuning. Therefore, in order to scale to 32 GPUs, we can only apply a small batch size of 3-4 per GPU. This makes fine-tuning tasks communication intensive and hard to scale. 1-bit Adam addresses the scaling challenge well, obtaining 3.4x communication reduction without enlarging batch size, and it results in a 2.7x end-to-end speedup.

Figure 7: Performance of 1-bit Adam for SQuAD fine-tuning on 40 gbps Ethernet during the compression stage.

Figure 8: Performance of 1-bit Adam for SQuAD fine-tuning on 40 gbps InfiniBand interconnect during the compression stage.

Updated: September 8, 2020

**Examples:**

Example 1 (unknown):
```unknown
1 / (warmup + (1 – warmup)/16)
```

---
