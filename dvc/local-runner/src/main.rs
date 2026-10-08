use anyhow::{ensure, Context, Result};
use clap::{Parser, ValueEnum};
use serde::Serialize;
use sp1_sdk::{Prover, ProverClient, SP1PublicValues, SP1Stdin};
use std::{fs, path::PathBuf};

#[derive(Clone, Copy, Debug, ValueEnum)]
enum Mode {
    Execute,
    Prove,
}

#[derive(Debug, Parser)]
#[command(about = "Run the Credit Gate SP1 ELF locally; no data is uploaded")]
struct Args {
    #[arg(long, value_enum)]
    mode: Mode,
    #[arg(long)]
    input: PathBuf,
    #[arg(long, default_value = concat!(env!("CARGO_MANIFEST_DIR"), "/../credit-gate-program/target/elf-compilation/riscv32im-succinct-zkvm-elf/release/credit-gate-dvc-program"))]
    elf: PathBuf,
    #[arg(long, default_value = concat!(env!("CARGO_MANIFEST_DIR"), "/../proof-output"))]
    output_dir: PathBuf,
}

#[derive(Serialize)]
struct ProofMetadata {
    format: &'static str,
    elf_sha256: String,
    public_values_hex: String,
    proof_file: &'static str,
    verification_key_file: &'static str,
}

fn decode_result(mut public_values: SP1PublicValues) -> Result<String> {
    let (status, payload): (u32, Option<String>) = public_values.read();
    ensure!(status == 0, "guest rejected the input (status {status})");
    payload.context("guest returned success without a result")
}

fn main() -> Result<()> {
    let args = Args::parse();
    let elf = fs::read(&args.elf)
        .with_context(|| format!("could not read SP1 ELF at {}", args.elf.display()))?;
    let input = fs::read_to_string(&args.input)
        .with_context(|| format!("could not read private DVC input at {}", args.input.display()))?;
    let mut stdin = SP1Stdin::new();
    stdin.write(&input);

    // Force local CPU proving. This runner never selects the hosted Prover Network.
    let client = ProverClient::builder().cpu().build();
    match args.mode {
        Mode::Execute => {
            let (public_values, report) = client.execute(&elf, &stdin).run()
                .context("SP1 guest execution failed; check the DVC input and attestation")?;
            let result = decode_result(public_values)?;
            println!("Guest executed successfully. Public result: {result}");
            println!("Guest instruction count: {}", report.total_instruction_count());
        }
        Mode::Prove => {
            let (pk, vk) = client.setup(&elf);
            let proof = client.prove(&pk, &stdin).run()
                .context("local SP1 CPU proof generation failed")?;
            client.verify(&proof, &vk).context("local proof verification failed")?;
            let result = decode_result(proof.public_values.clone())?;

            fs::create_dir_all(&args.output_dir)
                .with_context(|| format!("could not create {}", args.output_dir.display()))?;
            let proof_path = args.output_dir.join("credit-gate-proof.bin");
            let vk_path = args.output_dir.join("credit-gate-vkey.bin");
            fs::write(&proof_path, bincode::serialize(&proof)?)?;
            fs::write(&vk_path, bincode::serialize(&vk)?)?;
            let metadata = ProofMetadata {
                format: "SP1 SDK bincode proof; local CPU; not an on-chain verifier format",
                elf_sha256: hex::encode(sha2::Sha256::digest(&elf)),
                public_values_hex: hex::encode(proof.public_values.raw()),
                proof_file: "credit-gate-proof.bin",
                verification_key_file: "credit-gate-vkey.bin",
            };
            fs::write(args.output_dir.join("metadata.json"), serde_json::to_vec_pretty(&metadata)?)?;
            println!("Locally generated proof and verified it with the matching verification key.");
            println!("Public result: {result}");
            println!("Artifacts saved in {} (no upload performed).", args.output_dir.display());
        }
    }
    Ok(())
}

use sha2::Digest;
