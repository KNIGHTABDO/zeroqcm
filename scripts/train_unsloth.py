"""
ZeroQCM — Unsloth Fine-Tuning Script for Vast.ai RTX 4090
Model: DeepSeek-R1-Distill-Qwen-7B
Dataset: Jip7e/zeroqcm-moroccan-medical

Usage on Vast.ai:
  python train_unsloth.py \
    --model_name "unsloth/DeepSeek-R1-Distill-Qwen-7B-unsloth-bnb-4bit" \
    --hf_dataset "Jip7e/zeroqcm-moroccan-medical" \
    --hf_output "Jip7e/zeroqcm-medical-r1-7b" \
    --hf_token "YOUR_HF_TOKEN"
"""

import os
import argparse
import torch
from unsloth import FastLanguageModel, is_bfloat16_supported
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import load_dataset

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_name", type=str, default="unsloth/DeepSeek-R1-Distill-Qwen-7B-unsloth-bnb-4bit",
                        help="Base model to fine-tune")
    parser.add_argument("--hf_dataset", type=str, default="Jip7e/zeroqcm-moroccan-medical",
                        help="Hugging Face dataset repo")
    parser.add_argument("--hf_output", type=str, default="Jip7e/zeroqcm-medical-r1-7b",
                        help="Hugging Face repo name to save the model")
    parser.add_argument("--hf_token", type=str, default=os.getenv("HF_TOKEN"),
                        help="Hugging Face Write Token")
    parser.add_argument("--max_seq_length", type=int, default=2048)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--grad_accum", type=int, default=2)
    parser.add_argument("--learning_rate", type=float, default=2e-4)
    args = parser.parse_args()

    if not args.hf_token:
        raise ValueError("HF token is required! Provide via --hf_token or HF_TOKEN environment variable.")

    print("=================================================================")
    print(f"🚀 Initializing FastLanguageModel: {args.model_name}")
    print(f"📦 Dataset: {args.hf_dataset}")
    print(f"💾 Target Output: {args.hf_output}")
    print("=================================================================\n")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model_name,
        max_seq_length=args.max_seq_length,
        load_in_4bit=True,
        token=args.hf_token,
    )

    print("\n🔧 Configuring LoRA Adapters (Rank 16, Alpha 32)...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=32,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
    )

    print(f"\n📥 Loading dataset from {args.hf_dataset}...")
    dataset = load_dataset(args.hf_dataset, data_files={"train": "train.jsonl", "val": "val.jsonl"}, token=args.hf_token)
    train_data = dataset["train"]
    val_data = dataset.get("val", None)

    print(f"  • Training examples:   {len(train_data):,}")
    if val_data:
        print(f"  • Validation examples: {len(val_data):,}")

    print("\n🔄 Applying ChatML format with tokenization...")
    def formatting_prompts_func(examples):
        convos = examples["messages"]
        texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False) for convo in convos]
        return {"text": texts}

    train_data = train_data.map(formatting_prompts_func, batched=True, remove_columns=train_data.column_names)
    if val_data:
        val_data = val_data.map(formatting_prompts_func, batched=True, remove_columns=val_data.column_names)

    print("\n🏋️ Initializing SFTTrainer with BF16 on RTX 4090...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_data,
        eval_dataset=val_data,
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        dataset_num_proc=4,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=args.batch_size,
            gradient_accumulation_steps=args.grad_accum,
            warmup_ratio=0.05,
            num_train_epochs=args.epochs,
            learning_rate=args.learning_rate,
            fp16=not is_bfloat16_supported(),
            bf16=is_bfloat16_supported(),
            logging_steps=10,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            seed=3407,
            output_dir="outputs",
            report_to="none",
            save_strategy="steps",
            save_steps=2500,
            save_total_limit=2,
        ),
    )

    print("\n🔥 Training Started...")
    trainer_stats = trainer.train()
    print("\n✅ Training Complete!")

    print(f"\n📤 Saving LoRA adapter to Hugging Face: {args.hf_output}...")
    model.push_to_hub_lora(
        args.hf_output,
        tokenizer=tokenizer,
        token=args.hf_token
    )

    print(f"\n🎉 ALL DONE! Your model is live at: https://huggingface.co/{args.hf_output}")

if __name__ == "__main__":
    main()
