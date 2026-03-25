# Llama-Factory - Advanced

**Pages:** 14

---

## GPT-OSS¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/best_practice/gpt-oss.html

**Contents:**
- GPT-OSS¶
- 3 Steps to LoRA Fine-tuning for GPT-OSS¶
  - 1. Install LLaMA-Factory and transformers¶
  - 2. Train GPT-OSS on a single GPU (requires VRAM > 44 GB, multi-GPU supported)¶
  - 3. Merge LoRA Weights¶
  - Chat with the Fine-tuned Model¶
  - Full Fine-tuning Script¶

Fine-tune the Model via Web UI:

---

## NPU 推理¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/npu_inference.html

**Contents:**
- NPU 推理¶
- 环境安装¶
  - 版本需求¶
  - 硬件环境¶
  - 软件环境¶
  - vLLM-Ascend安装¶
  - LLaMA-Factory安装¶
- 推理测试¶
  - 可视化界面¶
  - 性能对比¶

Python：>= 3.10, < 3.12

CANN >= 8.1.RC1，包括 toolkit、kernels、nnal。

使用下述命令安装 vLLM-Ascend 。

使用下述命令安装 LLaMA-Factory 。

使用下述命令启动LLaMA-Factory的可视化界面。

选择模型并切换到chat模式并将推理引擎修改为vLLM，然后点击加载模型。

在推理性能上。vLLM框架比huggingface的推理速度提升了超过一倍。

---

## Trainers¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/trainers.html

**Contents:**
- Trainers¶
- Pre-training¶
- Post-training¶
  - Supervised Fine-Tuning¶
  - RLHF¶
    - Reward model¶
    - PPO¶
  - DPO¶
  - KTO¶

大语言模型通过在一个大型的通用数据集上通过无监督学习的方式进行预训练来学习语言的表征/初始化模型权重/学习概率分布。 我们期望在预训练后模型能够处理大量、多种类的数据集，进而可以通过监督学习的方式来微调模型使其适应特定的任务。

预训练时，请将 stage 设置为 pt ，并确保使用的数据集符合 预训练数据集 格式 。

在预训练结束后，模型的参数得到初始化，模型能够理解语义、语法以及识别上下文关系，在处理一般性任务时有着不错的表现。 尽管模型涌现出的零样本学习，少样本学习的特性使其能在一定程度上完成特定任务， 但仅通过提示（prompt）并不一定能使其表现令人满意。因此，我们需要后训练(post-training)来使得模型在特定任务上也有足够好的表现。

Supervised Fine-Tuning(监督微调)是一种在预训练模型上使用小规模有标签数据集进行训练的方法。 相比于预训练一个全新的模型，对已有的预训练模型进行监督微调是更快速更节省成本的途径。

监督微调时，请将 stage 设置为 sft 。 下面提供监督微调的配置示例：

由于在监督微调中语言模型学习的数据来自互联网，所以模型可能无法很好地遵循用户指令，甚至可能输出非法、暴力的内容，因此我们需要将模型行为与用户需求对齐(alignment)。 通过 RLHF(Reinforcement Learning from Human Feedback) 方法，我们可以通过人类反馈来进一步微调模型，使得模型能够更好更安全地遵循用户指令。

但是，获取真实的人类数据是十分耗时且昂贵的。一个自然的想法是我们可以训练一个奖励模型（reward model）来代替人类对语言模型的输出进行评价。 为了训练这个奖励模型，我们需要让奖励模型获知人类偏好，而这通常通过输入经过人类标注的偏好数据集来实现。 在偏好数据集中，数据由三部分组成：输入、好的回答、坏的回答。奖励模型在偏好数据集上训练，从而可以更符合人类偏好地评价语言模型的输出。

在训练奖励模型时，请将 stage 设置为 rm ，确保使用的数据集符合 偏好数据集 格式并且指定奖励模型的保存路径。 以下提供一个示例：

在训练奖励完模型之后，我们可以开始进行模型的强化学习部分。与监督学习不同，在强化学习中我们没有标注好的数据。语言模型接受prompt作为输入，其输出作为奖励模型的输入。奖励模型评价语言模型的输出，并将评价返回给语言模型。确保两个模型都能良好运行是一个具有挑战性的任务。 一种实现方式是使用近端策略优化（PPO，Proximal Policy Optimization）。其主要思想是：我们既希望语言模型的输出能够尽可能地获得奖励模型的高评价，又不希望语言模型的变化过于“激进”。 通过这种方法，我们可以使得模型在学习趋近人类偏好的同时不过多地丢失其原有的解决问题的能力。

在使用 PPO 进行强化学习时，请将 stage 设置为 ppo，并且指定所使用奖励模型的路径。 下面是一个示例：

既然同时保证语言模型与奖励模型的良好运行是有挑战性的，一种想法是我们可以丢弃奖励模型， 进而直接基于人类偏好训练我们的语言模型，这大大简化了训练过程。

在使用 DPO 时，请将 stage 设置为 dpo，确保使用的数据集符合 偏好数据集 格式并且设置偏好优化相关参数。 以下是一个示例：

KTO(Kahneman-Taversky Optimization) 的出现是为了解决成对的偏好数据难以获得的问题。 KTO使用了一种新的损失函数使其只需二元的标记数据， 即只需标注回答的好坏即可训练，并取得与 DPO 相似甚至更好的效果。

在使用 KTO 时，请将 stage 设置为 kto ，设置偏好优化相关参数并使用 KTO 数据集。

---

## 模型支持¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/model_support.html

**Contents:**
- 模型支持¶
- 注册 template¶
- 多模态数据构建¶
- 提供模型路径¶

LLaMA-Factory 允许用户添加自定义模型支持。我们将以 LLaMA-4 多模态模型为例，详细介绍如何为新模型添加支持。对于多模态模型，我们需要完成两个主要任务：

首先，我们可以通过以下方法获取 LLaMA-4 模型的 template

输出如下。通过观察输出我们可以得到模型的 chat_template。除此以外也可以通过 huggingface repo 来获取模型的 template.

通过观察输出，我们可以得知 LLaMA-4 的 chat_template 主要由以下几部分组成：

用户消息： <|header_start|>user<|header_end|>\n\n{{content}}<|eot|>

助手消息： <|header_start|>assistant<|header_end|>\n\n{{content}}<|eot|>

系统消息： <|header_start|>system<|header_end|>\n\n{{content}}<|eot|>

工具消息： <|header_start|>ipython<|header_end|>\n\n"{{content}}"<|eot|>

我们可以在 src/llamafactory/data/template.py 中使用 register_template 方法为自定义模型注册 chat_template。 在实际应用中，我们往往会在用户输入的信息后添加助手回复模板的头部 <|header_start|>assistant<|header_end|> 来引导模型进行回复。 因此我们可以看到，用户消息和工具输出的模板中都附有了助手回复的头部，而助手消息格式 format_assitant 也因此省略了助手回复的头部， 只保留其内容部分 {{content}}<|eot|>

我们可以根据上面的输出完成 name, format_user, format_assistant, format_system 与 format_observation 字段的填写。

format_prefix 字段用于指定模型的开头部分，通常可以在 tokenizer_config.json 中找到。

stop_words 字段用于指定模型的停止词，可以在 generation_config.json 中找到 eos_token_id，再把 eos_token_id 对应的 token 填入。

对于多模态模型，我们还需要在 mm_plugin 字段中指定多模态插件。

对于多模态模型，我们参照原始模型在 LLaMA-Factory 中实现多模态数据的解析。

我们可以在 src/llamafactory/data/mm_plugin.py 中实现 Llama4Plugin 类来解析多模态数据。

Llama4Plugin 类继承自 BasePlugin 类，并实现了 get_mm_inputs 和 process_messages 方法来解析多模态数据。

get_mm_inputs 的作用是将图像、视频等多模态数据转化为模型可以接收的输入，如 pixel_values。为实现 get_mm_inputs，首先我们需要检查 llama4 的 processor 是否可以与 已有实现 兼容。 模型官方仓库中的 processing_llama4.py 表明 llama4 的 processor 返回数据包含字段 pixel_values，这与 LLaMA-Factory 中的已有实现兼容。因此，我们只需要参照已有的 get_mm_inputs 方法实现即可。

process_messages 的作用是根据输入图片/视频的大小，数量等信息在 messages 中插入相应数量的占位符，以便模型可以正确解析多模态数据。 我们需要参考 原仓库实现 以及 LLaMA-Factory 中的规范返回 list[dict[str, str]] 类型的 messages 。

最后, 在 src/llamafactory/extras/constants.py 中提供模型的下载路径。 例如：

**Examples:**

Example 1 (python):
```python
========== Template ==========
<|begin_of_text|><|header_start|>user<|header_end|>

{{content}}<|eot|><|header_start|>assistant<|header_end|>

{{content}}<|eot|><|header_start|>system<|header_end|>

{{content}}<|eot|><|header_start|>ipython<|header_end|>

"{{content}}"<|eot|><|header_start|>assistant<|header_end|>
```

Example 2 (python):
```python
register_template(
    # 模板名称
    name="llama4",
    # 用户消息格式，结尾附有 generation prompt 的模板
    format_user=StringFormatter(
        slots=["<|header_start|>user<|header_end|>\n\n{{content}}<|eot|><|header_start|>assistant<|header_end|>\n\n"]
    ),
    # 助手消息格式
    format_assistant=StringFormatter(slots=["{{content}}<|eot|>"]),
    # 系统消息格式
    format_system=StringFormatter(slots=["<|header_start|>system<|header_end|>\n\n{{content}}<|eot|>"]),
    # 函数调用格式
    format_function=FunctionFormatter(slots=["{{content}}<|eot|>"], tool_format="llama3"),
    # 工具输出格式，结尾附有 generation prompt 的模板
    format_observation=StringFormatter(
        slots=[
            "<|header_start|>ipython<|header_end|>\n\n{{content}}<|eot|><|header_start|>assistant<|header_end|>\n\n"
        ]
    ),
    # 工具调用格式
    format_tools=ToolFormatter(tool_format="llama3"),
    format_prefix=EmptyFormatter(slots=[{"bos_token"}]),
    stop_words=["<|eot|>", "<|eom|>"],
    mm_plugin=get_mm_plugin(name="llama4", image_token="<|image|>"),
)
```

---

## Quantization¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/quantization.html

**Contents:**
- Quantization¶
- PTQ¶
  - GPTQ¶
- QAT¶
  - AWQ¶
- AQLM¶
- OFTQ¶
  - bitsandbytes¶
  - HQQ¶
  - EETQ¶

随着语言模型规模的不断增大，其训练的难度和成本已成为共识。 而随着用户数量的增加，模型推理的成本也在不断攀升，甚至可能成为限制模型部署的首要因素。 因此，我们需要对模型进行压缩以加速推理过程，而模型量化是其中一种有效的方法。

大语言模型的参数通常以高精度浮点数存储，这导致模型推理需要大量计算资源。 量化技术通过将高精度数据类型存储的参数转换为低精度数据类型存储， 可以在不改变模型参数量和架构的前提下加速推理过程。这种方法使得模型的部署更加经济高效，也更具可行性。

浮点数一般由3部分组成：符号位、指数位和尾数位。指数位越大，可表示的数字范围越大。尾数位越大、数字的精度越高。

量化可以根据何时量化分为：后训练量化和训练感知量化，也可以根据量化参数的确定方式分为：静态量化和动态量化。

后训练量化（PTQ, Post-Training Quantization）一般是指在模型预训练完成后，基于校准数据集（calibration dataset）确定量化参数进而对模型进行量化。

GPTQ(Group-wise Precision Tuning Quantization)是一种静态的后训练量化技术。”静态”指的是预训练模型一旦确定,经过量化后量化参数不再更改。GPTQ 量化技术将 fp16 精度的模型量化为 4-bit ,在节省了约 75% 的显存的同时大幅提高了推理速度。 为了使用GPTQ量化模型，您需要指定量化模型名称或路径，例如 model_name_or_path: TechxGenus/Meta-Llama-3-8B-Instruct-GPTQ

在训练感知量化（QAT, Quantization-Aware Training）中，模型一般在预训练过程中被量化，然后又在训练数据上再次微调，得到最后的量化模型。

AWQ（Activation-Aware Layer Quantization）是一种静态的后训练量化技术。其思想基于：有很小一部分的权重十分重要，为了保持性能这些权重不会被量化。 AWQ 的优势在于其需要的校准数据集更小，且在指令微调和多模态模型上表现良好。 为了使用 AWQ 量化模型,您需要指定量化模型名称或路径，例如 model_name_or_path: TechxGenus/Meta-Llama-3-8B-Instruct-AWQ

AQLM（Additive Quantization of Language Models）作为一种只对模型权重进行量化的PTQ方法，在 2-bit 量化下达到了当时的最佳表现，并且在 3-bit 和 4-bit 量化下也展示了性能的提升。 尽管 AQLM 在模型推理速度方面的提升并不是最显著的，但其在 2-bit 量化下的优异表现意味着您可以以极低的显存占用来部署大模型。

OFTQ(On-the-fly Quantization)指的是模型无需校准数据集，直接在推理阶段进行量化。OFTQ是一种动态的后训练量化技术. OFTQ在保持性能的同时。 因此，在使用OFTQ量化方法时，您需要指定预训练模型、指定量化方法 quantization_method 和指定量化位数 quantization_bit 下面提供了一个使用bitsandbytes量化方法的配置示例：

区别于 GPTQ, bitsandbytes 是一种动态的后训练量化技术。bitsandbytes 使得大于 1B 的语言模型也能在 8-bit 量化后不过多地损失性能。 经过bitsandbytes 8-bit 量化的模型能够在保持性能的情况下节省约50%的显存。

依赖校准数据集的方法往往准确度较高，不依赖校准数据集的方法往往速度较快。HQQ（Half-Quadratic Quantization）希望能在准确度和速度之间取得较好的平衡。作为一种动态的后训练量化方法，HQQ无需校准阶段， 但能够取得与需要校准数据集的方法相当的准确度，并且有着极快的推理速度。

EETQ(Easy and Efficient Quantization for Transformers)是一种只对模型权重进行量化的PTQ方法。具有较快的速度和简单易用的特性。

---

## NPU 训练¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/npu_training.html

**Contents:**
- NPU 训练¶
- 支持设备¶
- 单机微调¶
- 多机微调¶

Atlas A2训练系列（Atlas 800T A2, Atlas 900 A2 PoD, Atlas 200T A2 Box16, Atlas 300T A2）

Atlas 800I A2推理系列（Atlas 800I A2）

以 davinci0 单卡为例，下载并使用ascend llamafactory镜像。

首先在环境当前目录下执行如下命令，进入容器。

如果在单机上使用多卡微调时，可使用 --device /dev/davinci1, --device /dev/davinci2, ... 来增加 NPU 卡。

昇腾 NPU 卡从 0 开始编号，docker 容器内也是如此；

如映射物理机上的 davinci6，davinci7 NPU 卡到容器内使用，其对应的卡号分别为 0，1

进入docker后安装相关依赖、设置环境变量、配置 LoRA 微调参数文件(qwen1_5_lora_sft_ds.yaml)

ASCEND_RT_VISIBLE_DEVICES=0指定使用容器内卡号

USE_MODELSCOPE_HUB=1使用modelscope

在 LLAMA-Factory 目录下，创建如下 qwen1_5_lora_sft_ds.yaml：

使用 torchrun 启动 LoRA 微调，如正常输出模型加载、损失 loss 等日志，即说明成功微调。

经 LoRA 微调后，通过 llamafactory-cli chat 使用微调后的模型进行交互对话，使用 Ctrl+C 或输入 exit 退出该问答聊天。

多机微调时，不建议使用容器部署方式（单机都不够用的情况下，起多个容器资源更加紧张），请直接在每个节点安装 llamafactory（请参考 NPU 中的安装步骤），同时仍需要安装 DeepSpeed 和 ModelScope：

安装成功后，请在每个节点上使用 export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3 显式指定所需的 NPU 卡号，不指定时默认使用当前节点的所有 NPU 卡。

然后，必须在每个节点上使用 export HCCL_SOCKET_IFNAME=eth0 来指定当前节点的 HCCL 通信网卡（请使用目标网卡名替换 eth0）。

以两机环境为例，分别在主、从节点（机器）上执行如下两条命令即可启动多机训练：

---

## NPU¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/npu.html

**Contents:**
- NPU¶
- Install By Docker¶
  - 使用 docker-compose 构建并启动 docker 容器¶
  - 不使用 docker-compose¶
- Install By pip¶
  - 依赖1: NPU 驱动¶
  - 依赖2: NPU 开发包¶
  - 依赖3: torch-npu¶
  - 依赖校验¶
- Verification¶

目前LLaMA-Factory 通过 torch-npu 库完成了对华为昇腾 910b 系列芯片的支持, 包含 32GB 和 64GB 两个版本。跟其他使用相比，会需要额外3个前置条件

CANN Toolkit 和 Kernels库正常安装

为方便昇腾用户使用，LLaMA-Factory 提供已预装昇腾环境的 Install By Docker 及自行安装昇腾环境，Install By pip 两种方式，可按需自行选择：

请确保宿主机已根据昇腾卡型号成功安装对应的固件和驱动，可参考 快速安装昇腾环境 指引。

LLaMA-Factory 提供 使用 docker-compose 构建并启动 docker 容器 和 不使用 docker-compose 两种构建方式，请根据需求选择其一。

进入 LLaMA-Factory 项目中存放 Dockerfile 及 docker-compose.yaml 的 docker-npu 目录：

构建 docker 镜像并启动 docker 容器：

使用 docker build 直接构建 docker 镜像：

自行 pip 安装时， python 版本建议使用3.10， 目前该版本对于 NPU 的使用情况会相对稳定，其他版本可能会遇到一些未知的情况

可以按照 快速安装昇腾环境 指引，或者使用以下命令完成快速安装：

依赖3建议在安装 LLaMA-Factory 的时候一起选配安装， 把 torch-npu 一起加入安装目标，命令如下

3个依赖都安装后，可以通过如下的 python 脚本对 torch_npu 的可用情况做一下校验

使用以下指令对 LLaMA-Factory × 昇腾的安装进行校验：

如下所示，正确显示 LLaMA-Factory、PyTorch NPU 和 CANN 版本号及 NPU 型号等信息即说明安装成功。

前面依赖安装完毕和完成校验后，即可像文档的其他部分一样正常使用 llamafactory-cli 的相关功能， NPU 的使用是无侵入的。主要的区别是需要修改一下命令行中 设备变量使用 将原来的 Nvidia 卡的变量 CUDA_VISIBLE_DEVICES 替换为 ASCEND_RT_VISIBLE_DEVICES， 类似如下命令

通过 ASCEND_RT_VISIBLE_DEVICES 环境变量指定昇腾 NPU 卡，如 ASCEND_RT_VISIBLE_DEVICES=0,1,2,3 指定使用 0，1，2，3四张 NPU 卡进行微调/推理。

昇腾 NPU 卡从 0 开始编号，docker 容器内也是如此； 如映射物理机上的 6，7 号 NPU 卡到容器内使用，其对应的卡号分别为 0，1

检查是否安装 torch-npu，建议通过 pip install -e '.[torch-npu,metrics]' 安装 LLaMA-Factory。

Q：使用昇腾 NPU 推理报错 RuntimeError: ACL stream synchronize failed, error code:507018

A: 设置 do_sample: false，取消随机抽样策略。

https://github.com/hiyouga/LLaMA-Factory/issues/3840

Q：使用 ChatGLM 系列模型微调/训练模型时，报错 NotImplementedError: Unknown device for graph fuser

A: 在 modelscope 或 huggingface 下载的 repo 里修改 modeling_chatglm.py 代码，取消 torch.jit 装饰器注释

https://github.com/hiyouga/LLaMA-Factory/issues/3788

https://github.com/hiyouga/LLaMA-Factory/issues/4228

Q：微调/训练启动后，HCCL 报错，包含如下关键信息：

A: 杀掉 device 侧所有进程，等待 10s 后重新启动训练。

https://github.com/hiyouga/LLaMA-Factory/issues/3839

Q：使用 TeleChat 模型在昇腾 NPU 推理时，报错 AssertionError： Torch not compiled with CUDA enabled

A: 此问题一般由代码中包含 cuda 相关硬编码造成，根据报错信息，找到 cuda 硬编码所在位置，对应修改为 NPU 代码。如 .cuda() 替换为 .npu() ； .to("cuda") 替换为 .to("npu")

Q：模型微调遇到报错 DeviceType must be NPU. Actual DeviceType is: cpu，例如下列报错信息

A: 此类报错通常为部分 Tensor 未放到 NPU 上，请确保报错中算子所涉及的操作数均在 NPU 上。如上面的报错中，MulKernelNpuOpApi 算子为乘法算子，应确保 next_tokens 和 unfinished_sequences 均已放在 NPU 上。

如需更多 LLaMA-Factory × 昇腾实践指引，可参考 全流程昇腾实践 。

---

## Monitors¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/monitor.html

**Contents:**
- Monitors¶
- LlamaBoard¶
- SwanLab¶
- TensorBoard¶
- Wandb¶
- MLflow¶

LLaMA-Factory 支持多种训练可视化工具，包括：LlamaBoard 、 SwanLab、TensorBoard 、 Wandb 、 MLflow 。

LlamaBoard 是指 WebUI 中自带的Loss曲线看板，可以方便的查看训练过程中的Loss变化情况。

如果你想使用 LlamaBoard，只需使用 WebUI 启动训练即可。

SwanLab 是一个开源的训练跟踪与可视化工具，云端和离线均可使用，支持超参数记录、指标记录、多实验对比、硬件监控、实验环境记录等功能，可以有效地帮助开发者管理实验。

如果你想使用 SwanLab，请在启动训练时在训练配置文件中添加以下参数：

或者，在WebUI的 SwanLab 模块中开启 SwanLab 记录：

TensorBoard 是 TensorFlow 开源的离线训练跟踪工具，可以用于记录与可视化训练过程。

如果你想使用 TensorBoard，请在启动训练时在训练配置文件中添加以下参数：

或者，在WebUI的 其他参数设置 模块中的 启用外部记录面板 中开启 TensorBoard 记录：

Wandb（Weights and Biases）是一个云端的训练跟踪工具，可以用于记录与可视化训练过程。

如果你想使用 Wandb，请在启动训练时在训练配置文件中添加以下参数：

或者，在WebUI的 其他参数设置 模块中的 启用外部记录面板 中开启 Wandb 记录：

MLflow 是Databricks开源的离线训练跟踪工具，用于记录与可视化训练过程。

如果你想使用 MLflow，请在启动训练时在训练配置文件中添加以下参数：

或者，在WebUI的 其他参数设置 模块中的 启用外部记录面板 中开启 MLflow 记录：

---

## Acceleration¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/acceleration.html

**Contents:**
- Acceleration¶
- FlashAttention¶
- Unsloth¶
- Liger Kernel¶

LLaMA-Factory 支持多种加速技术，包括：FlashAttention 、 Unsloth 、 Liger Kernel 。

FlashAttention 能够加快注意力机制的运算速度，同时减少对内存的使用。

如果您想使用 FlashAttention,请在启动训练时在训练配置文件中添加以下参数：

Unsloth 框架支持 Llama, Mistral, Phi-3, Gemma, Yi, DeepSeek, Qwen等大语言模型并且支持 4-bit 和 16-bit 的 QLoRA/LoRA 微调，该框架在提高运算速度的同时还减少了显存占用。

如果您想使用 Unsloth, 请在启动训练时在训练配置文件中添加以下参数：

Liger Kernel 是一个大语言模型训练的性能优化框架, 可有效地提高吞吐量并减少内存占用。

如果您想使用 Liger Kernel,请在启动训练时在训练配置文件中添加以下参数：

---

## Distributed Training¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/distributed.html

**Contents:**
- Distributed Training¶
- NativeDDP¶
  - 单机多卡¶
    - llamafactory-cli¶
    - torchrun¶
    - accelerate¶
  - 多机多卡¶
    - llamafactory-cli¶
    - torchrun¶
    - accelerate¶

LLaMA-Factory 支持单机多卡和多机多卡分布式训练。同时也支持 DDP , DeepSpeed 和 FSDP 三种分布式引擎。

DDP (DistributedDataParallel) 通过实现模型并行和数据并行实现训练加速。 使用 DDP 的程序需要生成多个进程并且为每个进程创建一个 DDP 实例，他们之间通过 torch.distributed 库同步。

DeepSpeed 是微软开发的分布式训练引擎，并提供ZeRO（Zero Redundancy Optimizer）、offload、Sparse Attention、1 bit Adam、流水线并行等优化技术。 您可以根据任务需求与设备选择使用。

FSDP 通过全切片数据并行技术（Fully Sharded Data Parallel）来处理更多更大的模型。在 DDP 中，每张 GPU 都各自保留了一份完整的模型参数和优化器参数。而 FSDP 切分了模型参数、梯度与优化器参数，使得每张 GPU 只保留这些参数的一部分。 除了并行技术之外，FSDP 还支持将模型参数卸载至CPU，从而进一步降低显存需求。

NativeDDP 是 PyTorch 提供的一种分布式训练方式，您可以通过以下命令启动训练：

您可以使用 llamafactory-cli 启动 NativeDDP 引擎。

如果 CUDA_VISIBLE_DEVICES 没有指定，则默认使用所有GPU。如果需要指定GPU，例如第0、1个GPU，可以使用：

您也可以使用 torchrun 指令启动 NativeDDP 引擎进行单机多卡训练。下面提供一个示例：

您还可以使用 accelerate 指令启动进行单机多卡训练。

首先运行以下命令，根据需求回答一系列问题后生成配置文件：

您也可以使用 torchrun 指令启动 NativeDDP 引擎进行多机多卡训练。

您还可以使用 accelerate 指令启动进行多机多卡训练。

首先运行以下命令，根据需求回答一系列问题后生成配置文件：

DeepSpeed 是由微软开发的一个开源深度学习优化库，旨在提高大模型训练的效率和速度。在使用 DeepSpeed 之前，您需要先估计训练任务的显存大小，再根据任务需求与资源情况选择合适的 ZeRO 阶段。

ZeRO-1: 仅划分优化器参数，每个GPU各有一份完整的模型参数与梯度。

ZeRO-2: 划分优化器参数与梯度，每个GPU各有一份完整的模型参数。

ZeRO-3: 划分优化器参数、梯度与模型参数。

简单来说：从 ZeRO-1 到 ZeRO-3，阶段数越高，显存需求越小，但是训练速度也依次变慢。此外，设置 offload_param=cpu 参数会大幅减小显存需求，但会极大地使训练速度减慢。因此，如果您有足够的显存， 应当使用 ZeRO-1，并且确保 offload_param=none。

LLaMA-Factory提供了使用不同阶段的 DeepSpeed 配置文件的示例。包括：

https://huggingface.co/docs/transformers/deepspeed 提供了更为详细的介绍。

您可以使用 llamafactory-cli 启动 DeepSpeed 引擎进行单机多卡训练。

为了启动 DeepSpeed 引擎，配置文件中 deepspeed 参数指定了 DeepSpeed 配置文件的路径:

您也可以使用 deepspeed 指令启动 DeepSpeed 引擎进行单机多卡训练。

使用 deepspeed 指令启动 DeepSpeed 引擎时您无法使用 CUDA_VISIBLE_DEVICES 指定GPU。而需要：

--include localhost:1 表示只是用本节点的gpu1。

LLaMA-Factory 支持使用 DeepSpeed 的多机多卡训练，您可以通过以下命令启动：

您也可以使用 deepspeed 指令来启动多机多卡训练。

hostfile的每一行指定一个节点，每行的格式为 <hostname> slots=<num_slots> ， 其中 <hostname> 是节点的主机名， <num_slots> 是该节点上的GPU数量。下面是一个例子： .. code-block:

请在 https://www.deepspeed.ai/getting-started/ 了解更多。

如果没有指定 hostfile 变量, DeepSpeed 会搜索 /job/hostfile 文件。如果仍未找到，那么 DeepSpeed 会使用本机上所有可用的GPU。

您还可以使用 accelerate 指令启动 DeepSpeed 引擎。 首先通过以下命令生成 DeepSpeed 配置文件：

只需在 ZeRO-0 的基础上修改 zero_optimization 中的 stage 参数即可。

只需在 ZeRO-0 的基础上在 zero_optimization 中添加 offload_optimizer 参数即可。

只需在 ZeRO-0 的基础上修改 zero_optimization 中的参数。

只需在 ZeRO-3 的基础上添加 zero_optimization 中的 offload_optimizer 和 offload_param 参数即可。

https://www.deepspeed.ai/docs/config-json/ 提供了关于deepspeed配置文件的更详细的介绍。

PyTorch 的全切片数据并行技术 FSDP （Fully Sharded Data Parallel）能让我们处理更多更大的模型。LLaMA-Factory支持使用 FSDP 引擎进行分布式训练。

FSDP 的参数 ShardingStrategy 的不同取值决定了模型的划分方式：

FULL_SHARD: 将模型参数、梯度和优化器状态都切分到不同的GPU上，类似ZeRO-3。

SHARD_GRAD_OP: 将梯度、优化器状态切分到不同的GPU上，每个GPU仍各自保留一份完整的模型参数。类似ZeRO-2。

NO_SHARD: 不切分任何参数。类似ZeRO-0。

您只需根据需要修改 examples/accelerate/fsdp_config.yaml 以及 examples/extras/fsdp_qlora/llama3_lora_sft.yaml ，文件然后运行以下命令即可启动 FSDP+QLoRA 微调：

此外，您也可以使用 accelerate 启动 FSDP 引擎， 节点数与 GPU 数可以通过 num_machines 和 num_processes 指定。对此，Huggingface 提供了便捷的配置功能。 只需运行：

根据提示回答一系列问题后，我们就可以生成 FSDP 所需的配置文件。

当然您也可以根据需求自行配置 fsdp_config.yaml 。

请确保 num_processes 和实际使用的总GPU数量一致

不要在 FSDP+QLoRA 中使用 GPTQ/AWQ 模型

---

## Arguments¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/arguments.html

**Contents:**
- Arguments¶
- Finetuning Arguments¶
  - 基本参数¶
  - LoRA¶
  - RLHF¶
  - Freeze¶
  - Apollo¶
  - BAdam¶
  - GaLore¶
- Data Arguments¶

是否以纯 bf16 精度训练模型（不使用 AMP）。

Literal[“pt”, “sft”, “rm”, “ppo”, “dpo”, “kto”]

Literal[“lora”, “freeze”, “full”]

是否仅训练扩展块中的参数（LLaMA Pro 模式）。

freeze_multi_modal_projector

是否在评估时计算 token 级别的准确率。

include_effective_tokens_per_second

除 LoRA 层之外设置为可训练并保存在最终检查点中的模块名称。使用逗号分隔多个模块。

LoRA 缩放系数。一般情况下为 lora_rank * 2。

LoRA 微调的本征维数 r，r 越大可训练的参数越多。

应用 LoRA 方法的模块名称。使用逗号分隔多个模块，使用 all 指定所有模块。

LoRA+ 学习率比例(λ = ηB/ηA)。 ηA, ηB 分别是 adapter matrices A 与 B 的学习率。

loraplus_lr_embedding

是否使用秩稳定 LoRA (Rank-Stabilized LoRA)。

是否使用权重分解 LoRA（Weight-Decomposed LoRA）。

PiSSA 中 FSVD 执行的迭代步数。使用 -1 将其禁用。

是否将 PiSSA 适配器转换为正常的 LoRA 适配器。

是否创建一个具有随机初始化权重的新适配器。

DPO 训练中的 sft loss 系数。

Literal[“sigmoid”, “hinge”, “ipo”, “kto_pair”, “orpo”, “simpo”]

DPO 训练中使用的偏好损失类型。可选值为： sigmoid, hinge, ipo, kto_pair, orpo, simpo。

标签平滑系数，取值范围为 [0,0.5]。

KTO 训练中 chosen 标签 loss 的权重。

KTO 训练中 rejected 标签 loss 的权重。

SimPO 损失中的 reward margin。

PPO 训练中的 mini-batch 大小。

PPO 训练中自适应 KL 控制的目标 KL 值。

PPO 或 DPO 训练中使用的参考模型路径。

ref_model_quantization_bit

参考模型的量化位数，支持 4 位或 8 位量化。

reward_model_adapters

reward_model_quantization_bit

Literal[“lora”, “full”, “api”]

PPO 训练中使用的奖励模型类型。可选值为： lora, full, api。

freeze_trainable_layers

可训练层的数量。正数表示最后 n 层被设置为可训练的，负数表示前 n 层被设置为可训练的。

freeze_trainable_modules

可训练层的名称。使用 all 来指定所有模块。

除了隐藏层外可以被训练的模块名称，被指定的模块将会被设置为可训练的。使用逗号分隔多个模块。

适用 APOLLO 的模块名称。使用逗号分隔多个模块，使用 all 指定所有线性模块。

apollo_update_interval

Literal[“svd”, “random”]

APOLLO 低秩投影算法类型（svd 或 random）。

Literal[“std”, “right”, “left”]

Literal[“channel”, “tensor”]

APOLLO 缩放类型（channel 或 tensor）。

BAdam 的使用模式，可选值为 layer 或 ratio。

layer-wise BAdam 的起始块索引。

layer-wise BAdam 中块更新策略，可选值有： ascending, descending, random, fixed。

badam_switch_interval

layer-wise BAdam 中块更新步数间隔。使用 -1 禁用块更新。

ratio-wise BAdam 中的更新比例。

BAdam 优化器的掩码模式，可选值为 adjacent 或 scatter。

BAdam 优化器的详细输出级别，0 表示无输出，1 表示输出块前缀，2 表示输出可训练参数。

应用 GaLore 的模块名称。使用逗号分隔多个模块，使用 all 指定所有线性模块。

galore_update_interval

GaLore 投影的类型，可选值有： std, reverse_std, right, left, full。

用于训练的数据集名称。使用逗号分隔多个数据集。

用于评估的数据集名称。使用逗号分隔多个数据集。

是否在每个评估数据集上分开计算loss，默认concate后为整体计算。

Union[str, Dict[str, Any]]

存储数据集的文件夹路径，可以是字符串或字典。 类型：str 或 dict（需符合 dataset_info.json 的格式）

当为字符串时，表示数据集目录的路径，例如：data 。

当为字典时，将覆盖默认从本地 dataset_info.json 加载的行为。应具有以下结构：

存储图像、视频或音频的文件夹路径。如果未指定，默认为 dataset_dir。

data_shared_file_system

多机多卡时，不同机器存放数据集的路径是否是共享文件系统。数据集处理在该值为true时只在第一个node发生，为false时在每个node都处理一次。

输入的最大 token 数，超过该长度会被截断。

启用 streaming 时用于随机选择样本的 buffer 大小。

Literal[“concat”, “interleave_under”, “interleave_over”]

数据集混合策略，支持 concat、 interleave_under、 interleave_over。

使用 interleave 策略时，指定从多个数据集中采样的概率。多个数据集的概率用逗号分隔。

preprocessing_batch_size

preprocessing_num_workers

每个数据集的最大样本数：设置后，每个数据集的样本数将被截断至指定的 max_samples。

ignore_pad_token_for_loss

计算 loss 时是否忽略 pad token。

验证集相对所使用的训练数据集的大小。取值在 [0,1) 之间。启用 streaming 时 val_size 应是整数。

是否启用 sequences packing。预训练时默认启用。

是否启用不使用 cross-attention 的 sequences packing。

Tokenized datasets的保存或加载路径。如果路径存在，会加载已有的 tokenized datasets；如果路径不存在，则会在分词后将 tokenized datasets 保存在此路径中。

模型路径（本地路径或 Huggingface/ModelScope 路径）。

适配器路径（本地路径或 Huggingface/ModelScope 路径）。使用逗号分隔多个适配器路径。

保存从 Hugging Face 或 ModelScope 下载的模型的本地路径。

是否使用 fast_tokenizer 。

是否在分词时将 special token 分割。

要添加到 tokenizer 中的 special token。多个 special token 用逗号分隔。

Optional[Literal[“linear”, “dynamic”, “yarn”, “llama3”]]

RoPE Embedding 的缩放策略，支持 linear、dynamic、yarn 或 llama3。

Literal[“auto”, “disabled”, “sdpa”, “fa2”]

是否启用 FlashAttention 来加速训练和推理。可选值为 auto, disabled, sdpa, fa2。

是否启用 Shift Short Attention (S^2-Attn)。

Optional[Literal[“convert”, “load”]]

需要将模型转换为 mixture_of_depths（MoD）模型时指定： convert 需要加载 mixture_of_depths（MoD）模型时指定： load。

是否使用 unsloth 优化 LoRA 微调。

MoE 架构中 aux_loss 系数。数值越大，各个专家负载越均衡。

disable_gradient_checkpointing

是否将 layernorm 层权重精度提高至 fp32。

是否将 lm_head 输出精度提高至 fp32。

Literal[“huggingface”, “vllm”]

推理时使用的后端引擎，支持 huggingface 或 vllm。

Literal[“auto”, “float16”, “bfloat16”, “float32”]

推理时使用的模型权重和激活值的数据类型。支持 auto, float16, bfloat16, float32。

用于登录 HuggingFace 的验证 token。

用于登录 ModelScope Hub 的验证 token。

用于登录 Modelers Hub 的验证 token。

是否信任来自 Hub 上数据集/模型的代码执行。

Optional[torch.dtype]

用于计算模型输出的数据类型，无需手动指定。

Optional[Union[str, Dict[str, Any]]]

是否禁用 vLLM 中的 CUDA graph。

Optional[Union[dict, str]]

vLLM引擎初始化配置。以字典或JSON字符串输入。

Literal[“bitsandbytes”, “hqq”, “eetq”]

指定用于量化的算法，支持 “bitsandbytes”, “hqq” 和 “eetq”。

指定在量化过程中使用的位数，通常是4位、8位等。

Literal[“fp4”, “nf4”]

量化时使用的数据类型，支持 “fp4” 和 “nf4”。

是否在量化过程中使用 double quantization，通常用于 “bitsandbytes” int4 量化训练。

quantization_device_map

Optional[Literal[“auto”]]

用于推理 4-bit 量化模型的设备映射。需要 “bitsandbytes >= 0.43.0”。

Literal[“cpu”, “auto”]

导出模型时使用的设备，auto 可自动加速导出。

export_quantization_bit

export_quantization_dataset

用于量化导出模型的数据集路径或数据集名称。

export_quantization_nsamples

export_quantization_maxlen

True： .bin 格式保存。 False： .safetensors 格式保存。

模型上传至 Huggingface 的仓库名称。

评估任务的名称，可选项有 mmlu_test, ceval_validation, cmmlu_test

保存评估结果的路径。 如果该路径已经存在则会抛出错误。

评估数据集的下载模式，如果数据集已经存在则重复使用，否则则下载。

DownloadMode.REUSE_DATASET_IF_EXISTS

是否使用采样策略生成文本。如果设置为 False，将使用 greedy decoding。

用于调整生成文本的随机性。temperature 越高，生成的文本越随机；temperature 越低，生成的文本越确定。

用于控制生成时候选 token 集合大小的参数。例如：top_p = 0.7 意味着模型会先选择概率最高的若干个 token 直到其累积概率之和大于 0.7，然后在这些 token 组成的集合中进行采样。

用于控制生成时候选 token 集合大小的参数。例如：top_k = 50 意味着模型会在概率最高的50个 token 组成的集合中进行采样。

用于 beam_search 的束宽度。值为 1 表示不使用 beam_search。

文本最大长度（包括输入文本和生成文本的长度）。

生成文本的最大长度。设置 max_new_tokens 会覆盖 max_length。

对生成重复 token 的惩罚系数。对于已经生成过的 token 生成概率乘以 1/repetition_penalty。值小于 1.0 会提高重复 token 的生成概率，大于 1.0 则会降低重复 token 的生成概率。

在使用 beam_search 时对生成文本长度的惩罚系数。length_penalty > 0 鼓励模型生成更长的序列，length_penalty < 0 会鼓励模型生成更短的序列。

默认的 system_message，例如: “You are a helpful assistant.”

Literal[“cloud”, “local”]

训练结果将保存在 <ray_storage_path>/ray_run_name 路径下。

每个工作进程分配的资源。默认使用 1 GPU。

Literal[“SPREAD”, “PACK”, “STRICT_SPREAD”, “STRICT_PACK”]

Ray 训练的资源调度策略。可选值包括 SPREAD、PACK、STRICT_SPREAD 和 STRICT_PACK。

DISABLE_VERSION_CHECK

LLAMAFACTORY_VERBOSITY

设置 LLaMA-Factory 的日志级别(“DEBUG”,”INFO”,”WARN”)

优先使用 ModelScope 下载模型/数据集或使用缓存路径中的模型/数据集

优先使用 Openmind 下载模型/数据集或使用缓存路径中的模型/数据集

是否使用 Ray 进行分布式执行或任务管理。

是否表示启用特定的 PyTorch 优化。

ASCEND_RT_VISIBLE_DEVICES

Torchrun部署中主节点 (master node) 的网络地址

Torchrun部署中主节点用于通信的端口号

当前节点在所有节点中的 rank，通常从 0 到 NNODES-1。

设置 Gradio 服务器 IP 地址（例如 0.0.0.0）

启用 Gradio 服务器的 IPv6 支持

支持使用 lmf 表示 llamafactory-cli

---

## Adapters¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/adapters.html

**Contents:**
- Adapters¶
- Full Parameter Fine-tuning¶
- Freeze¶
- LoRA¶
  - LoRA+¶
  - rsLoRA¶
  - DoRA¶
  - PiSSA¶
- Galore¶
- BAdam¶

LLaMA-Factory 支持多种调优算法，包括： Full Parameter Fine-tuning 、 Freeze 、 LoRA 、 Galore 、 BAdam 。

全参微调指的是在训练过程中对于预训练模型的所有权重都进行更新，但其对显存的要求是巨大的。

如果您需要进行全参微调，请将 finetuning_type 设置为 full 。 下面是一个例子：

Freeze(冻结微调)指的是在训练过程中只对模型的小部分权重进行更新，这样可以降低对显存的要求。

如果您需要进行冻结微调，请将 finetuning_type 设置为 freeze 并且设置相关参数, 例如冻结的层数 freeze_trainable_layers 、可训练的模块名称 freeze_trainable_modules 等。

freeze_trainable_layers

可训练层的数量。正数表示最后 n 层被设置为可训练的，负数表示前 n 层被设置为可训练的。默认值为 2

freeze_trainable_modules

可训练层的名称。使用 all 来指定所有模块。默认值为 all

freeze_extra_modules[非必须]

除了隐藏层外可以被训练的模块名称，被指定的模块将会被设置为可训练的。使用逗号分隔多个模块。默认值为 None

如果您需要进行 LoRA 微调，请将 finetuning_type 设置为 lora 并且设置相关参数。 下面是一个例子：

additional_target[非必须]

除 LoRA 层之外设置为可训练并保存在最终检查点中的模块名称。使用逗号分隔多个模块。默认值为 None

LoRA 缩放系数。一般情况下为 lora_rank * 2, 默认值为 None

LoRA 微调中的 dropout 率。默认值为 0

LoRA 微调的本征维数 r， r 越大可训练的参数越多。默认值为 8

应用 LoRA 方法的模块名称。使用逗号分隔多个模块，使用 all 指定所有模块。默认值为 all

loraplus_lr_ratio[非必须]

LoRA+ 学习率比例(λ = ηB/ηA)。 ηA, ηB 分别是 adapter matrices A 与 B 的学习率。LoRA+ 的理想取值与所选择的模型和任务有关。默认值为 None

loraplus_lr_embedding[非必须]

LoRA+ 嵌入层的学习率, 默认值为 1e-6

是否使用秩稳定 LoRA(Rank-Stabilized LoRA)，默认值为 False。

是否使用权重分解 LoRA（Weight-Decomposed LoRA），默认值为 False

是否初始化 PiSSA 适配器，默认值为 False

PiSSA 中 FSVD 执行的迭代步数。使用 -1 将其禁用，默认值为 16

是否将 PiSSA 适配器转换为正常的 LoRA 适配器，默认值为 False

是否创建一个具有随机初始化权重的新适配器，默认值为 False

在LoRA中，适配器矩阵 A 和 B 的学习率相同。您可以通过设置 loraplus_lr_ratio 来调整学习率比例。在 LoRA+ 中，适配器矩阵 A 的学习率 ηA 即为优化器学习率。适配器矩阵 B 的学习率 ηB 为 λ * ηA。 其中 λ 为 loraplus_lr_ratio 的值。

LoRA 通过添加低秩适配器进行微调，然而 lora_rank 的增大往往会导致梯度塌陷，使得训练变得不稳定。这使得在使用较大的 lora_rank 进行 LoRA 微调时较难取得令人满意的效果。rsLoRA(Rank-Stabilized LoRA) 通过修改缩放因子使得模型训练更加稳定。 使用 rsLoRA 时， 您只需要将 use_rslora 设置为 True 并设置所需的 lora_rank。

DoRA （Weight-Decomposed Low-Rank Adaptation）提出尽管 LoRA 大幅降低了推理成本，但这种方式取得的性能与全量微调之间仍有差距。

DoRA 将权重矩阵分解为大小与单位方向矩阵的乘积，并进一步微调二者（对方向矩阵则进一步使用 LoRA 分解），从而实现 LoRA 与 Full Fine-tuning 之间的平衡。

如果您需要使用 DoRA，请将 use_dora 设置为 True 。

在 LoRA 中，适配器矩阵 A 由 kaiming_uniform 初始化，而适配器矩阵 B 则全初始化为0。这导致一开始的输入并不会改变模型输出并且使得梯度较小，收敛较慢。 PiSSA 通过奇异值分解直接分解原权重矩阵进行初始化，其优势在于它可以更快更好地收敛。

如果您需要使用 PiSSA，请将 pissa_init 设置为 True 。

当您需要在训练中使用 GaLore（Gradient Low-Rank Projection）算法时，可以通过设置 GaloreArguments 中的参数进行配置。

不要将 LoRA 和 GaLore/BAdam 一起使用。

``galore_layerwise``为 ``true``时请不要设置 ``gradient_accumulation``参数。

是否使用 GaLore 算法，默认值为 False。

应用 GaLore 的模块名称。使用逗号分隔多个模块，使用 all 指定所有线性模块。默认值为 all。

galore_update_interval

更新 GaLore 投影的步数间隔，默认值为 200。

GaLore 的缩放系数，默认值为 0.25。

GaLore 投影的类型，可选值有： std , reverse_std, right, left, full。默认值为 std。

是否启用逐层更新以进一步节省内存，默认值为 False。

BAdam 是一种内存高效的全参优化方法，您通过配置 BAdamArgument 中的参数可以对其进行详细设置。 下面是一个例子：

不要将 LoRA 和 GaLore/BAdam 一起使用。

使用 BAdam 时请设置 finetuning_type 为 full 且 pure_bf16 为 True 。

badam_mode = layer 时仅支持使用 DeepSpeed ZeRO3 进行 单卡 或 多卡 训练。

badam_mode = ratio 时仅支持 单卡 训练。

是否使用 BAdam 优化器，默认值为 False。

BAdam 的使用模式，可选值为 layer 或 ratio，默认值为 layer。

layer-wise BAdam 的起始块索引，默认值为 None。

layer-wise BAdam 中块更新策略，可选值有： ascending, descending, random, fixed。默认值为 ascending。

badam_switch_interval

layer-wise BAdam 中块更新步数间隔。使用 -1 禁用块更新，默认值为 50。

ratio-wise BAdam 中的更新比例，默认值为 0.05。

BAdam 优化器的掩码模式，可选值为 adjacent 或 scatter，默认值为 adjacent。

BAdam 优化器的详细输出级别，0 表示无输出，1 表示输出块前缀，2 表示输出可训练参数。默认值为 0。

---

## Extras¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/extras.html

**Contents:**
- Extras¶
- LLaMA Pro¶

为了解决大语言模型的遗忘问题， LLaMA Pro 通过在原有模型上增加新模块以适应新的任务，使其在多个新任务上的表现均优于原始模型。 LLaMA-Factory 支持 LLaMA Pro 的使用。 您可以使用运行 expand.sh 将 Meta-Llama-3-8B-Instruct 扩展为 llama3-8b-instruct-pro。

对于 LLaMA Pro 模型进行训练时，您需要指定 use_llama_pro 为 true。

---

## Fine-tuning Best Practices¶

**URL:** https://llamafactory.readthedocs.io/en/latest/advanced/best_practice/index.html

**Contents:**
- Fine-tuning Best Practices¶

---
