# Llama-Factory - Getting Started

**Pages:** 7

---

## Installation¶

**URL:** https://llamafactory.readthedocs.io/en/latest/getting_started/installation.html

**Contents:**
- Installation¶
- Linux¶
  - CUDA 安装¶
- Windows¶
  - CUDA 安装¶
- LLaMA-Factory 安装¶
- LLaMA-Factory 校验¶
- LLaMA-Factory 高级选项¶
  - Windows¶
    - QLoRA¶

CUDA 是由 NVIDIA 创建的一个并行计算平台和编程模型，它让开发者可以使用 NVIDIA 的 GPU 进行高性能的并行计算。

首先，在 https://developer.nvidia.com/cuda-gpus 查看您的 GPU 是否支持CUDA

保证当前 Linux 版本支持CUDA. 在命令行中输入 uname -m && cat /etc/*release，应当看到类似的输出

检查是否安装了 gcc . 在命令行中输入 gcc --version ，应当看到类似的输出

在以下网址下载所需的 CUDA，这里推荐12.2版本。 https://developer.nvidia.com/cuda-gpus 注意需要根据上述输出选择正确版本

如果您之前安装过 CUDA(例如为12.1版本)，需要先使用 sudo /usr/local/cuda-12.1/bin/cuda-uninstaller 卸载。如果该命令无法运行，可以直接：

卸载完成后运行以下命令并根据提示继续安装：

注意:在确定 CUDA 自带驱动版本与 GPU 是否兼容之前,建议取消 Driver 的安装。

完成后输入 nvcc -V 检查是否出现对应的版本号，若出现则安装完成。

打开 设置 ，在 关于 中找到 Windows 规格 保证系统版本在以下列表中：

Microsoft Windows 11 21H2

Microsoft Windows 11 22H2-SV2

Microsoft Windows 11 23H2

Microsoft Windows 10 21H2

Microsoft Windows 10 22H2

Microsoft Windows Server 2022

打开 cmd 输入 nvcc -V ，若出现类似内容则安装成功。

否则，检查系统环境变量，保证 CUDA 被正确导入。

在安装 LLaMA-Factory 之前，请确保您安装了下列依赖:

运行以下指令以安装 LLaMA-Factory 及其依赖:

如果出现环境冲突，请尝试使用 pip install --no-deps -e . 解决

完成安装后，可以通过使用 llamafactory-cli version 来快速校验安装是否成功

如果您能成功看到类似下面的界面，就说明安装成功了。

如果您想在 Windows 上启用量化 LoRA（QLoRA），请根据您的 CUDA 版本选择适当的 bitsandbytes 发行版本。

如果您要在 Windows 平台上启用 FlashAttention-2，请根据您的 CUDA 版本选择适当的 flash-attention 发行版本。

开源深度学习框架 PyTorch，广泛用于机器学习和人工智能研究中。

提供了加载 Qwen v1 模型所需的包。

魔搭社区，提供了预训练模型和数据集的下载途径。

开源训练跟踪工具 SwanLab，用于记录与可视化训练过程

用于 LLaMA Factory 开发维护。

---

## WebUI¶

**URL:** https://llamafactory.readthedocs.io/en/latest/getting_started/webui.html

**Contents:**
- WebUI¶
- 训练¶
- 评估预测与对话¶
- 导出¶

LLaMA-Factory 支持通过 WebUI 零代码微调大语言模型。 在完成 安装 后，您可以通过以下指令进入 WebUI:

WebUI 主要分为四个界面：训练、评估与预测、对话、导出。

随后，您可以点击 开始 按钮开始训练模型。

关于断点重连:适配器断点保存于 output_dir 目录下，请指定 适配器路径 以加载断点继续训练。

如果您需要使用自定义数据集，请在 data/data_info.json 中添加自定义数据集描述并确保 数据集格式 正确，否则可能会导致训练失败。

模型训练完毕后，您可以通过在评估与预测界面通过指定 模型 及 适配器 的路径在指定数据集上进行评估。

您也可以通过在对话界面指定 模型、 适配器 及 推理引擎 后输入对话内容与模型进行对话观察效果。

如果您对模型效果满意并需要导出模型，您可以在导出界面通过指定 模型、 适配器、 分块大小、 导出量化等级及校准数据集、 导出设备、 导出目录 等参数后点击 导出 按钮导出模型。

---

## Merge¶

**URL:** https://llamafactory.readthedocs.io/en/latest/getting_started/merge_lora.html

**Contents:**
- Merge¶
- 合并¶
- 量化¶

当我们基于预训练模型训练好 LoRA 适配器后，我们不希望在每次推理的时候分别加载预训练模型和 LoRA 适配器，因此我们需要将预训练模型和 LoRA 适配器合并导出成一个模型，并根据需要选择是否量化。根据是否量化以及量化算法的不同，导出的配置文件也有所区别。

您可以通过 llamafactory-cli export merge_config.yaml 指令来合并模型。其中 merge_config.yaml 需要您根据不同情况进行配置。

examples/merge_lora/llama3_lora_sft.yaml 提供了合并时的配置示例。

模型 model_name_or_path 需要存在且与 template 相对应。 adapter_name_or_path 需要与微调中的适配器输出路径 output_dir 相对应。

合并 LoRA 适配器时，不要使用量化模型或指定量化位数。您可以使用本地或下载的未量化的预训练模型进行合并。

在完成模型合并并获得完整模型后，为了优化部署效果，人们通常会基于显存占用、使用成本和推理速度等因素，选择通过量化技术对模型进行压缩，从而实现更高效的部署。

量化（Quantization）通过数据精度压缩有效地减少了显存使用并加速推理。LLaMA-Factory 支持多种量化方法，包括:

GPTQ 等后训练量化方法(Post Training Quantization)是一种在训练后对预训练模型进行量化的方法。我们通过量化技术将高精度表示的预训练模型转换为低精度的模型，从而在避免过多损失模型性能的情况下减少显存占用并加速推理，我们希望低精度数据类型在有限的表示范围内尽可能地接近高精度数据类型的表示，因此我们需要指定量化位数 export_quantization_bit 以及校准数据集 export_quantization_dataset。

model_name_or_path: 预训练模型的名称或路径

export_quantization_bit: 量化位数

export_quantization_dataset: 量化校准数据集

export_size: 最大导出模型文件大小

export_legacy_format: 是否使用旧格式导出

QLoRA 是一种在 4-bit 量化模型基础上使用 LoRA 方法进行训练的技术。它在极大地保持了模型性能的同时大幅减少了显存占用和推理时间。

不要使用量化模型或设置量化位数 quantization_bit

---

## Inference¶

**URL:** https://llamafactory.readthedocs.io/en/latest/getting_started/inference.html

**Contents:**
- Inference¶
- 原始模型推理配置¶
- 微调模型推理配置¶
- 多模态模型¶
- 批量推理¶
  - 数据集¶
  - api¶

LLaMA-Factory 支持多种推理方式。

您可以使用 llamafactory-cli chat inference_config.yaml 或 llamafactory-cli webchat inference_config.yaml 进行推理与模型对话。对话时配置文件只需指定原始模型 model_name_or_path 和 template ，并根据是否是微调模型指定 adapter_name_or_path 和 finetuning_type。

如果您希望向模型输入大量数据集并保存推理结果，您可以启动 vllm 推理引擎对大量数据集进行快速的批量推理。您也可以通过 部署 api 服务的形式通过 api 调用来进行批量推理。

默认情况下，模型推理将使用 Huggingface 引擎。 您也可以指定 infer_backend: vllm 以使用 vllm 推理引擎以获得更快的推理速度。

使用任何方式推理时，模型 model_name_or_path 需要存在且与 template 相对应。

对于原始模型推理， inference_config.yaml 中 只需指定原始模型 model_name_or_path 和 template 即可。

对于微调模型推理，除原始模型和模板外，还需要指定适配器路径 adapter_name_or_path 和微调类型 finetuning_type。

对于多模态模型，您可以运行以下指令进行推理。

examples/inference/llava1_5.yaml 的配置示例如下：

您可以通过以下指令启动 vllm 推理引擎并使用数据集进行批量推理：

如果您需要使用 api 进行批量推理，您只需指定模型、适配器（可选）、模板、微调方式等信息。

下面是一个启动并调用 api 服务的示例：

您可以使用 API_PORT=8000 CUDA_VISIBLE_DEVICES=0 llamafactory-cli api examples/inference/llama3_lora_sft.yaml 启动 api 服务并运行以下示例程序进行调用：

---

## Eval¶

**URL:** https://llamafactory.readthedocs.io/en/latest/getting_started/eval.html

**Contents:**
- Eval¶
- 通用能力评估¶
- NLG 评估¶
- 评估相关参数¶

在完成模型训练后，您可以通过 llamafactory-cli eval examples/train_lora/llama3_lora_eval.yaml 来评估模型效果。

配置示例文件 examples/train_lora/llama3_lora_eval.yaml 具体如下：

此外，您还可以通过 llamafactory-cli train examples/extras/nlg_eval/llama3_lora_predict.yaml 来获得模型的 BLEU 和 ROUGE 分数以评价模型生成质量。

配置示例文件 examples/extras/nlg_eval/llama3_lora_predict.yaml 具体如下：

同样，您也通过在指令 python scripts/vllm_infer.py --model_name_or_path path_to_merged_model --dataset alpaca_en_demo 中指定模型、数据集以使用 vllm 推理框架以取得更快的推理速度。

评估任务的名称，可选项有 mmlu_test, ceval_validation, cmmlu_test

包含评估数据集的文件夹路径，默认值为 evaluation。

用于数据加载器的随机种子，默认值为 42。

评估使用的语言，可选值为 en、 zh。默认值为 en。

few-shot 的示例数量，默认值为 5。

保存评估结果的路径，默认值为 None。 如果该路径已经存在则会抛出错误。

评估数据集的下载模式，默认值为 DownloadMode.REUSE_DATASET_IF_EXISTS。如果数据集已经存在则重复使用，否则则下载。

---

## Data Preparation¶

**URL:** https://llamafactory.readthedocs.io/en/latest/getting_started/data_preparation.html

**Contents:**
- Data Preparation¶
- Alpaca¶
  - 指令监督微调数据集¶
  - 预训练数据集¶
  - 偏好数据集¶
  - KTO 数据集¶
  - 多模态数据集¶
    - 图像数据集¶
    - 视频数据集¶
    - 音频数据集¶

dataset_info.json 包含了所有经过预处理的 本地数据集 以及 在线数据集。如果您希望使用自定义数据集，请 务必 在 dataset_info.json 文件中添加对数据集及其内容的定义。

目前我们支持 Alpaca 格式和 ShareGPT 格式的数据集。

指令监督微调(Instruct Tuning)通过让模型学习详细的指令以及对应的回答来优化模型在特定指令下的表现。

instruction 列对应的内容为人类指令， input 列对应的内容为人类输入， output 列对应的内容为模型回答。下面是一个例子

在进行指令监督微调时， instruction 列对应的内容会与 input 列对应的内容拼接后作为最终的人类输入，即人类输入为 instruction\ninput。而 output 列对应的内容为模型回答。 在上面的例子中，人类的最终输入是：

如果指定， system 列对应的内容将被作为系统提示词。

history 列是由多个字符串二元组构成的列表，分别代表历史消息中每轮对话的指令和回答。注意在指令监督微调时，历史消息中的回答内容也会被用于模型学习。

下面提供一个 alpaca 格式 多轮 对话的例子，对于单轮对话只需省略 history 列即可。

对于上述格式的数据， dataset_info.json 中的 数据集描述 应为：

大语言模型通过学习未被标记的文本进行预训练，从而学习语言的表征。通常，预训练数据集从互联网上获得，因为互联网上提供了大量的不同领域的文本信息，有助于提升模型的泛化能力。 预训练数据集文本描述格式如下：

在预训练时，只有 text 列中的 内容 （即document）会用于模型学习。

对于上述格式的数据， dataset_info.json 中的 数据集描述 应为：

偏好数据集用于奖励模型训练、DPO 训练和 ORPO 训练。对于系统指令和人类输入，偏好数据集给出了一个更优的回答和一个更差的回答。

一些研究 表明通过让模型学习“什么更好”可以使得模型更加迎合人类的需求。 甚至可以使得参数相对较少的模型的表现优于参数更多的模型。

偏好数据集需要在 chosen 列中提供更优的回答，并在 rejected 列中提供更差的回答，在一轮问答中其格式如下：

对于上述格式的数据，dataset_info.json 中的 数据集描述 应为：

KTO数据集与偏好数据集类似，但不同于给出一个更优的回答和一个更差的回答，KTO数据集对每一轮问答只给出一个 true/false 的 label。 除了 instruction 以及 input 组成的人类最终输入和模型回答 output ，KTO 数据集还需要额外添加一个 kto_tag 列（true/false）来表示人类的反馈。

对于上述格式的数据， dataset_info.json 中的 数据集描述 应为：

目前我们支持 多模态图像数据集、 视频数据集 以及 音频数据集 的输入。

多模态图像数据集需要额外添加一个 images 列，包含输入图像的路径。 注意图片的数量必须与文本中所有 <image> 标记的数量严格一致。

对于上述格式的数据， dataset_info.json 中的 数据集描述 应为：

多模态视频数据集需要额外添加一个 videos 列，包含输入视频的路径。 注意视频的数量必须与文本中所有 <video> 标记的数量严格一致。

对于上述格式的数据， dataset_info.json 中的 数据集描述 应为：

多模态音频数据集需要额外添加一个 audio 列，包含输入图像的路径。 注意音频的数量必须与文本中所有 <audio> 标记的数量严格一致。

对于上述格式的数据， dataset_info.json 中的 数据集描述 应为：

ShareGPT 格式中的 KTO数据集(样例)和多模态数据集(样例) 与 Alpaca 格式的类似。

预训练数据集不支持 ShareGPT 格式。

相比 alpaca 格式的数据集， sharegpt 格式支持 更多 的角色种类，例如 human、gpt、observation、function 等等。它们构成一个对象列表呈现在 conversations 列中。 下面是 sharegpt 格式的一个例子：

注意其中 human 和 observation 必须出现在奇数位置，gpt 和 function 必须出现在偶数位置。

对于上述格式的数据， dataset_info.json 中的 数据集描述 应为：

Sharegpt 格式的偏好数据集同样需要在 chosen 列中提供更优的消息，并在 rejected 列中提供更差的消息。 下面是一个例子：

对于上述格式的数据，dataset_info.json 中的 数据集描述 应为：

OpenAI 格式仅仅是 sharegpt 格式的一种特殊情况，其中第一条消息可能是系统提示词。

对于上述格式的数据， dataset_info.json 中的 数据集描述 应为：

---

## Supervised Fine-tuning¶

**URL:** https://llamafactory.readthedocs.io/en/latest/getting_started/sft.html

**Contents:**
- Supervised Fine-tuning¶
- 命令行¶

您可以使用以下命令使用 examples/train_lora/llama3_lora_sft.yaml 中的参数进行微调：

也可以通过追加参数更新 yaml 文件中的参数:

LLaMA-Factory 默认使用所有可见的计算设备。根据需求可通过 CUDA_VISIBLE_DEVICES 或 ASCEND_RT_VISIBLE_DEVICES 指定计算设备。

examples/train_lora/llama3_lora_sft.yaml 提供了微调时的配置示例。该配置指定了模型参数、微调方法参数、数据集参数以及评估参数等。您需要根据自身需求自行配置。

模型 model_name_or_path 、数据集 dataset 需要存在且与 template 相对应。

训练阶段，可选: rm(reward modeling), pt(pretrain), sft(Supervised Fine-Tuning), PPO, DPO, KTO, ORPO

微调方式。可选: freeze, lora, full

采取LoRA方法的目标模块，默认值为 all。

数据集模板，请保证数据集模板与模型相对应。

per_device_train_batch_size

gradient_accumulation_steps

学习率曲线，可选 linear, cosine, polynomial, constant 等。

---
