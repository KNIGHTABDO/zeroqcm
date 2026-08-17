"""
ZeroQCM — Unsloth Fine-Tuning Script for Vast.ai RTX 4090
Model: DeepSeek-R1-Distill-Qwen-7B or Jackrong/Qwen3.5-9B-Claude-4.6-Opus-Reasoning-Distilled-v2

Usage:
  python train.py --hf_dataset "YOUR_USERNAME/zeroqcm-moroccan-medical" --hf_output "YOUR_USERNAME/zeroqcm-deepseek-r1-7b" --hf_token "hf_xxx"
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
                        help="Base model to fine-tune (e.g., DeepSeek-R1-Distill-Qwen-7B or Jackrong/Qwen3.5-9B-Claude-4.6-Opus-Reasoning-Distilled-v2)")
    parser.add_argument("--hf_dataset", type=str, required=True,
                        help="Hugging Face dataset repo (e.g. username/zeroqcm-moroccan-medical)")
    parser.add_argument("--hf_output", type=str, required=True,
                        help="Hugging Face repo to save the fine-tuned model")
    parser.add_argument("--hf_token", type=str, default=os.getenv("HF_TOKEN"),
                        help="Hugging Face Write Token")
    parser.add_argument("--max_seq_length", type=int, default=2048)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch_size", type=int, default=4)
    parser.add_argument("--grad_accum", type=int, default=4)
    parser.add_argument("--learning_rate", type=float, default=2e-4)
    args = parser.parse_args()

    if not args.hf_token:
        raise ValueError("HF token is required! Provide via --hf_token or HF_TOKEN environment variable.")

    print(f"🚀 Initializing FastLanguageModel with {args.model_name}...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model_name,
        max_seq_length=args.max_seq_length,
        load_in_4bit=True,
        token=args.hf_token,
    )

    print("🔧 Adding LoRA adapters (Rank 16, Alpha 32)...")
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

    print(f"📥 Loading dataset from {args.hf_dataset}...")
    dataset = load_dataset(args.hf_dataset, split="train", token=args.hf_token)
    val_dataset = None
    try:
        val_dataset = load_dataset(args.hf_dataset, split="val", token=args.hf_token)
    except Exception:
        print("Note: No separate validation split found, continuing with train split.")

    print("🔄 Formatting dataset into ChatML template...")
    def formatting_prompts_func(examples):
        convos = examples["messages"]
        texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False) for convo in convos]
        return {"text": texts}

    dataset = dataset.map(formatting_prompts_func, batched=True)
    if val_dataset:
        val_dataset = val_dataset.map(formatting_prompts_func, batched=True)

    print("🏋️ Setting up SFTTrainer on RTX 4090 with BF16...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        eval_dataset=val_dataset,
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
            save_steps=2000,
            save_total_limit=2,
        ),
    )

    print("🔥 Starting Training...")
    trainer_stats = trainer.train()
    print("✅ Training complete!")

    print(f"📤 Uploading fine-tuned LoRA adapter to Hugging Face: {args.hf_output}...")
    model.push_to_hub_merged(
        args.hf_output,
        tokenizer,
        save_method="lora",
        token=args.hf_token
    )

    print(f"🎉 All done! Model saved to https://huggingface.co/{args.hf_output}")

if __name__ == "__main__":
    main()
