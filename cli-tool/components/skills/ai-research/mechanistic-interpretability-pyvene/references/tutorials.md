# pyvene Tutorials

## Tutorial 1: Basic Activation Patching

### Goal
Swap activations between two prompts to test causal relationships.

### Step-by-Step

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# 1. Load model
model = AutoModelForCausalLM.from_pretrained("gpt2")
tokenizer = AutoTokenizer.from_pretrained("gpt2")

# 2. Prepare inputs
base_prompt = "The Colosseum is in the city of"
source_prompt = "The Eiffel Tower is in the city of"

base_inputs = tokenizer(base_prompt, return_tensors="pt")
source_inputs = tokenizer(source_prompt, return_tensors="pt")

# 3. Define intervention (patch layer 8)
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=8,
            component="block_output",
            intervention_type=pv.VanillaIntervention,
        )
    ]
)

intervenable = pv.IntervenableModel(config, model)

# 4. Run intervention
_, patched_outputs = intervenable(
    base=base_inputs,
    sources=[source_inputs],
)

# 5. Check predictions
patched_logits = patched_outputs.logits
probs = torch.softmax(patched_logits[0, -1], dim=-1)

rome_token = tokenizer.encode(" Rome")[0]
paris_token = tokenizer.encode(" Paris")[0]

print(f"P(Rome): {probs[rome_token].item():.4f}")
print(f"P(Paris): {probs[paris_token].item():.4f}")
```

---

## Tutorial 2: Causal Tracing (ROME-style)

### Goal
Locate where factual associations are stored by corrupting inputs and restoring activations.

### Step-by-Step

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

model = AutoModelForCausalLM.from_pretrained("gpt2-xl")
tokenizer = AutoTokenizer.from_pretrained("gpt2-xl")

# 1. Define prompts
clean_prompt = "The Space Needle is in downtown"
# We'll corrupt by adding noise to embeddings

clean_inputs = tokenizer(clean_prompt, return_tensors="pt")
seattle_token = tokenizer.encode(" Seattle")[0]

# 2. Get clean baseline
with torch.no_grad():
    clean_outputs = model(**clean_inputs)
    clean_prob = torch.softmax(clean_outputs.logits[0, -1], dim=-1)[seattle_token].item()

print(f"Clean P(Seattle): {clean_prob:.4f}")

# 3. Sweep over layers - corrupt input, restore at each layer
results = []

for restore_layer in range(model.config.n_layer):
    # Config: add noise at input, restore at target layer
    config = pv.IntervenableConfig(
        representations=[
            # Noise intervention at embedding
            pv.RepresentationConfig(
                layer=0,
                component="block_input",
                intervention_type=pv.NoiseIntervention,
            ),
            # Restore clean at target layer
            pv.RepresentationConfig(
                layer=restore_layer,
                component="block_output",
                intervention_type=pv.VanillaIntervention,
            ),
        ]
    )

    intervenable = pv.IntervenableModel(config, model)

    # Source is clean (for restoration), base gets noise
    _, outputs = intervenable(
        base=clean_inputs,
        sources=[clean_inputs],  # Restore from clean
    )

    prob = torch.softmax(outputs.logits[0, -1], dim=-1)[seattle_token].item()
    results.append(prob)
    print(f"Restore at layer {restore_layer}: P(Seattle) = {prob:.4f}")

# 4. Find critical layers (where restoration helps most)
import numpy as np
results = np.array(results)
critical_layers = np.argsort(results)[-5:]
print(f"\nMost critical layers: {critical_layers}")
```

---

## Tutorial 3: Trainable Interventions (DAS)

### Goal
Learn a low-rank intervention that achieves a target counterfactual behavior.

### Step-by-Step

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

model = AutoModelForCausalLM.from_pretrained("gpt2")
tokenizer = AutoTokenizer.from_pretrained("gpt2")

# 1. Define trainable intervention
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=6,
            component="block_output",
            intervention_type=pv.LowRankRotatedSpaceIntervention,
            low_rank_dimension=64,  # Learn 64-dim subspace
        )
    ]
)

intervenable = pv.IntervenableModel(config, model)

# 2. Setup optimizer
optimizer = torch.optim.Adam(
    intervenable.get_trainable_parameters(),
    lr=1e-3
)

# 3. Training data (simplified example)
# Goal: Make model predict "Paris" instead of "Rome"
base_prompt = "The capital of Italy is"
target_token = tokenizer.encode(" Paris")[0]

base_inputs = tokenizer(base_prompt, return_tensors="pt")

# 4. Training loop
for step in range(100):
    optimizer.zero_grad()

    _, outputs = intervenable(
        base=base_inputs,
        sources=[base_inputs],  # Self-intervention
    )

    # Loss: maximize probability of target token
    logits = outputs.logits[0, -1]
    loss = -torch.log_softmax(logits, dim=-1)[target_token]

    loss.backward()
    optimizer.step()

    if step % 20 == 0:
        prob = torch.softmax(logits.detach(), dim=-1)[target_token].item()
        print(f"Step {step}: loss={loss.item():.4f}, P(Paris)={prob:.4f}")

# 5. Analyze learned rotation
rotation = intervenable.interventions["layer.6.comp.block_output.unit.pos.nunit.1#0"][0]
print(f"Learned rotation shape: {rotation.rotate_layer.weight.shape}")
```

---

## Tutorial 4: Position-Specific Intervention

### Goal
Intervene at specific token positions only.

### Step-by-Step

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("gpt2")
tokenizer = AutoTokenizer.from_pretrained("gpt2")

# 1. Setup
base_prompt = "John and Mary went to the store"
source_prompt = "Alice and Bob went to the store"

base_inputs = tokenizer(base_prompt, return_tensors="pt")
source_inputs = tokenizer(source_prompt, return_tensors="pt")

# 2. Position-specific config
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=5,
            component="block_output",
            intervention_type=pv.VanillaIntervention,
            unit="pos",
            max_number_of_units=1,  # Single position
        )
    ]
)

intervenable = pv.IntervenableModel(config, model)

# 3. Intervene at position 0 only (first name)
_, outputs = intervenable(
    base=base_inputs,
    sources=[source_inputs],
    unit_locations={"sources->base": ([[[0]]], [[[0]]])},
)

# 4. Intervene at multiple positions
_, outputs = intervenable(
    base=base_inputs,
    sources=[source_inputs],
    unit_locations={"sources->base": ([[[0, 2]]], [[[0, 2]]])},
)
```

---

## Tutorial 5: Collecting Activations

### Goal
Extract activations without modifying them.

### Step-by-Step

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("gpt2")
tokenizer = AutoTokenizer.from_pretrained("gpt2")

# 1. Config with CollectIntervention
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=5,
            component="block_output",
            intervention_type=pv.CollectIntervention,
        ),
        pv.RepresentationConfig(
            layer=10,
            component="attention_output",
            intervention_type=pv.CollectIntervention,
        ),
    ]
)

intervenable = pv.IntervenableModel(config, model)

# 2. Run and collect
inputs = tokenizer("Hello world", return_tensors="pt")
_, collected = intervenable(base=inputs)

# 3. Access collected activations
layer5_output = collected[0]
layer10_attn = collected[1]

print(f"Layer 5 block output shape: {layer5_output.shape}")
print(f"Layer 10 attention output shape: {layer10_attn.shape}")
```

---

## Tutorial 6: Generation with Interventions

### Goal
Apply interventions during text generation.

### Step-by-Step

```python
import pyvene as pv
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("gpt2")
tokenizer = AutoTokenizer.from_pretrained("gpt2")
tokenizer.pad_token = tokenizer.eos_token

# 1. Get steering direction (happy vs sad)
happy_inputs = tokenizer("I am very happy and", return_tensors="pt")
sad_inputs = tokenizer("I am very sad and", return_tensors="pt")

# Collect activations
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=6,
            component="mlp_output",
            intervention_type=pv.CollectIntervention,
        )
    ]
)
collector = pv.IntervenableModel(config, model)

_, happy_acts = collector(base=happy_inputs)
_, sad_acts = collector(base=sad_inputs)

steering_direction = happy_acts[0].mean(dim=1) - sad_acts[0].mean(dim=1)

# 2. Config for steering during generation
config = pv.IntervenableConfig(
    representations=[
        pv.RepresentationConfig(
            layer=6,
            component="mlp_output",
            intervention_type=pv.AdditionIntervention,
        )
    ]
)

intervenable = pv.IntervenableModel(config, model)

# 3. Generate with steering
prompt = "Today I feel"
inputs = tokenizer(prompt, return_tensors="pt")

# Create source with steering direction
# (This is simplified - actual implementation varies)
output = intervenable.generate(
    inputs,
    max_new_tokens=20,
    do_sample=True,
    temperature=0.7,
)

print(tokenizer.decode(output[0]))
```

---

## External Resources

### Official Tutorials
- [pyvene 101](https://stanfordnlp.github.io/pyvene/tutorials/pyvene_101.html)
- [Causal Tracing](https://stanfordnlp.github.io/pyvene/tutorials/advanced_tutorials/Causal_Tracing.html)
- [DAS Introduction](https://stanfordnlp.github.io/pyvene/tutorials/advanced_tutorials/DAS_Main_Introduction.html)
- [IOI Replication](https://stanfordnlp.github.io/pyvene/tutorials/advanced_tutorials/IOI_Replication.html)

### Papers
- [pyvene Paper](https://arxiv.org/abs/2403.07809) - NAACL 2024
- [ROME](https://arxiv.org/abs/2202.05262) - Meng et al. (2022)
- [Inference-Time Intervention](https://arxiv.org/abs/2306.03341) - Li et al. (2023)
