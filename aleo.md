# Aleo Ecosystem — Comprehensive Reference

> **Last Updated**: June 2025
> **Leo Version**: 4.0.0 | **SnarkOS**: Mainnet | **SDK**: `@provablehq/sdk`
> **Sources**: [Leo Docs](https://docs.leo-lang.org), [Aleo Developer](https://developer.aleo.org), [Provable API](https://docs.provable.com), [GitHub](https://github.com/ProvableHQ)

---
# Leo v4 Correct Pattern (verified from GitHub tests)

## Key Rules:
1. `final fn` functions go OUTSIDE `program {}` block
2. Inside entry `fn`, create Final with: `let f: Final = final { finalize_xxx(...); };`
3. Return Final in tuple or directly: `return (record, f);`
4. Cross-program calls return Final: `let (rec, transfer_f): (credits.aleo::credits, Final) = credits.aleo::transfer_xxx(...);`
5. Pass cross-program Finals to the final {} block call: `let f: Final = final { finalize_xxx(transfer_f, ...); };`
6. Inside `final fn`, run cross-program Finals with: `f.run();` or `Final::run(f);`
7. Mapping operations like `Mapping::get()`, `Mapping::set()` inside `final fn`
8. NOTE: The old `.get()` / `.set()` method syntax on mappings also still works in final fn context
9. `constructor` stays as special keyword inside `program {}` (NOT `fn`)
10. `@test fn` stays inside `program {}` block

## Example (cross-program call):
```leo
import credits.aleo;

program my_program.aleo {
    mapping balances: address => u128;

    fn deposit(private amount: u128, private credits_in: credits.aleo::credits) -> (credits.aleo::credits, Final) {
        let amount_u64: u64 = amount as u64;
        let (change, transfer_f): (credits.aleo::credits, Final) =
            credits.aleo::transfer_private_to_public(credits_in, self.address, amount_u64);
        let f: Final = final { finalize_deposit(transfer_f, self.signer, amount); };
        return (change, f);
    }
}

final fn finalize_deposit(transfer_f: Final, depositor: address, amount: u128) {
    transfer_f.run();
    let current: u128 = Mapping::get_or_use(balances, depositor, 0u128);
    Mapping::set(balances, depositor, current + amount);
}
```

## Table of Contents

1. [Aleo Platform Overview](#1-aleo-platform-overview)
2. [Leo Language (v4.0)](#2-leo-language-v40)
3. [Leo v4 Migration Guide](#3-leo-v4-migration-guide)
4. [Data Types & Primitives](#4-data-types--primitives)
5. [Programs, Functions & State](#5-programs-functions--state)
6. [Operators & Expressions](#6-operators--expressions)
7. [Interfaces & Dynamic Dispatch (v4)](#7-interfaces--dynamic-dispatch-v4)
8. [Leo Libraries (v4)](#8-leo-libraries-v4)
9. [Program Upgradability](#9-program-upgradability)
10. [Leo CLI](#10-leo-cli)
11. [Testing](#11-testing)
12. [Aleo Accounts](#12-aleo-accounts)
13. [Records (UTXO Model)](#13-records-utxo-model)
14. [Transactions](#14-transactions)
15. [Provable SDK (`@provablehq/sdk`)](#15-provable-sdk-provablehqsdk)
16. [Delegated Proving Service (DPS)](#16-delegated-proving-service-dps)
17. [Record Scanning Service (RSS)](#17-record-scanning-service-rss)
18. [Provable API v2](#18-provable-api-v2)
19. [Provable API v1](#19-provable-api-v1)
20. [SnarkOS & SnarkVM](#20-snarkos--snarkvm)
21. [Ecosystem & Resources](#21-ecosystem--resources)

---

## 1. Aleo Platform Overview

Aleo is a **Layer-1 blockchain** combining **general-purpose programmability** with **privacy by default**. The core idea is **ZEXE** (Zero-Knowledge Execution) — programs execute off-chain with zero-knowledge proofs, and only the proof is verified on-chain.

### Key Properties

| Property | Description |
|----------|-------------|
| **Privacy Model** | Private inputs, private outputs, private user identity |
| **State Model** | Record model (extended UTXO — encrypted arbitrary data) |
| **Consensus** | AleoBFT (Narwhal + Bullshark variant) |
| **Proving System** | Marlin (universal setup, updatable SRS) |
| **VM** | Aleo Virtual Machine (AVM) — executes Aleo Instructions |
| **Language** | Leo → compiles to Aleo Instructions → executes on AVM |
| **Native Token** | Aleo Credits (`credits.aleo`) — 1 Credit = 1,000,000 microcredits |

### Architecture

```
Leo Source (.leo)
    ↓  leo build
Aleo Instructions (.aleo)
    ↓  leo deploy / execute
AVM (snarkVM)
    ↓  prove
ZK Proof + Encrypted State
    ↓  broadcast
SnarkOS Network (validators)
    ↓  verify + finalize
On-chain State (mappings, records)
```

### Networks

| Network | Purpose | API Base |
|---------|---------|----------|
| **Mainnet** | Production | `https://api.provable.com/v2/mainnet` |
| **Testnet** | Development / Testing | `https://api.provable.com/v2/testnet` |

---

## 2. Leo Language (v4.0)

Leo is an open-source, **statically-typed, imperative** programming language designed for building private applications on Aleo. It abstracts the complexities of zero-knowledge cryptography.

### Key Features

- **Intuitive Syntax** — Influenced by JavaScript and Rust
- **Seamless Aleo Integration** — Compiles directly to Aleo Instructions
- **Robust Tooling** — CLI, VS Code, Sublime Text 3, IntelliJ plugins
- **Formal Verification** — Formally defined language structure
- **Statically Typed** — All types known at compile time
- **Pass by Value** — All expressions are copied when used as function inputs

### Project Layout

```
project/
├── program.json        # Program manifest (name, version, dependencies)
├── .env                # Private key for deployment
├── build/
│   ├── main.aleo       # Compiled Aleo Instructions
│   └── program.json    # Build manifest
├── imports/            # External program dependencies
├── src/
│   └── main.leo        # Main Leo source
└── outputs/            # Execution outputs
```

### Hello World (Leo v4)

```leo
program hello.aleo {
    // Entry function (was `transition` in v3)
    fn main(public a: u32, b: u32) -> u32 {
        let c: u32 = a + b;
        return c;
    }
}
```

---

## 3. Leo v4 Migration Guide

Leo 4.0.0 is a **major language overhaul**. Every Leo program must be updated.

### Syntax Changes

| Leo 3.x | Leo 4.0 | Notes |
|---------|---------|-------|
| `transition foo()` | `fn foo()` | Inside `program {}` block |
| `async transition foo() -> Future` | `fn foo() -> Final` | Inside `program {}` block |
| `function foo()` | `fn foo()` | Outside `program {}` block (helper) |
| `inline foo()` | `fn foo()` | Outside `program {}` block (helper) |
| `async { ... }` block | `final { ... }` block | On-chain finalization logic |
| `f.await()` | `f.run()` | Execute finalization future |
| `Future` type | `Final` type | Return type for async entry fns |
| `token.aleo/transfer()` | `token.aleo::transfer()` | External program calls use `::` |
| `@test script foo()` | `@test fn foo()` | Inside `program {}` block |

### Unified `fn` Keyword

In Leo v4, ALL functions use the **`fn`** keyword. The compiler determines the function type by context:

```leo
// Helper function (outside program block) — was `function` or `inline`
fn helper(a: u32, b: u32) -> u32 {
    return a + b;
}

program token.aleo {
    // Entry function (was `transition`) — callable externally
    fn transfer(receiver: address, amount: u64) -> token {
        // ...
    }

    // Async entry with on-chain finalize (was `async transition`)
    fn transfer_public(receiver: address, amount: u64) -> Final {
        // Off-chain logic
        return finalize_transfer_public(self.caller, receiver, amount);
    }

    // On-chain finalization (was `async { ... }`)
    final fn finalize_transfer_public(sender: address, receiver: address, amount: u64) {
        // Mapping updates happen here
        let sender_balance: u64 = Mapping::get(balances, sender);
        Mapping::set(balances, sender, sender_balance - amount);
        let receiver_balance: u64 = Mapping::get_or_use(balances, receiver, 0u64);
        Mapping::set(balances, receiver, receiver_balance + amount);
    }
}
```

### External Calls — `/` → `::`

```leo
// Leo 3.x
import token.aleo;
token.aleo/transfer(receiver, amount);

// Leo 4.0
import token.aleo;
token.aleo::transfer(receiver, amount);
```

### Final Instead of Future

```leo
// Leo 3.x
async transition do_something() -> Future {
    return finalize_do_something();
}

async function finalize_do_something() {
    // on-chain
}

// Leo 4.0
fn do_something() -> Final {
    return finalize_do_something();
}

final fn finalize_do_something() {
    // on-chain
}
```

### Running Finalization

```leo
// Leo 3.x
let f: Future = other_program.aleo/do_something();
f.await();

// Leo 4.0
let f: Final = other_program.aleo::do_something();
f.run();
```

### Removed Features

- **Scripts** — Removed entirely. Use `@test fn` inside `program {}` instead.
- **`leo debug`** — Removed. Use `leo test` instead.

---

## 4. Data Types & Primitives

### Scalar Types

| Type | Description | Example |
|------|-------------|---------|
| `bool` | Boolean | `true`, `false` |
| `u8` | Unsigned 8-bit integer | `255u8` |
| `u16` | Unsigned 16-bit integer | `65535u16` |
| `u32` | Unsigned 32-bit integer | `4294967295u32` |
| `u64` | Unsigned 64-bit integer | `100u64` |
| `u128` | Unsigned 128-bit integer | `1000u128` |
| `i8` | Signed 8-bit integer | `-128i8` |
| `i16` | Signed 16-bit integer | `-32768i16` |
| `i32` | Signed 32-bit integer | `42i32` |
| `i64` | Signed 64-bit integer | `-100i64` |
| `i128` | Signed 128-bit integer | `0i128` |
| `field` | Base field element | `1field` |
| `group` | Elliptic curve group element | `0group` |
| `scalar` | Scalar field element | `1scalar` |
| `address` | Aleo account address | `aleo1...` |
| `signature` | Schnorr signature | — |
| `identifier` | **(v4 new!)** Program identifier for dynamic dispatch | — |

### Composite Types

#### Struct

```leo
struct TokenInfo {
    name: field,
    symbol: field,
    decimals: u8,
    total_supply: u64,
}

// Usage
let info: TokenInfo = TokenInfo {
    name: 123field,
    symbol: 456field,
    decimals: 6u8,
    total_supply: 1000000u64,
};
```

#### Record

Records are the core privacy primitive — **encrypted UTXO-like** data structures.

```leo
record token {
    owner: address,     // Always present, always private
    amount: u64,        // Application data
    data: field,        // Arbitrary payload
}
```

#### Mapping

Mappings store **public on-chain** state (key-value store). Only accessible in `final` blocks.

```leo
mapping balances: address => u64;
mapping market_data: u64 => MarketInfo;
```

**Mapping Operations** (inside `final` blocks only):

```leo
// Get value (fails if key doesn't exist)
let balance: u64 = Mapping::get(balances, addr);

// Get with default
let balance: u64 = Mapping::get_or_use(balances, addr, 0u64);

// Set value
Mapping::set(balances, addr, new_balance);

// Check existence
let exists: bool = Mapping::contains(balances, addr);

// Remove key
Mapping::remove(balances, addr);
```

#### Arrays

```leo
let arr: [u32; 4] = [1u32, 2u32, 3u32, 4u32];
let element: u32 = arr[0]; // 0-indexed
```

#### Tuples

```leo
let t: (u32, bool) = (42u32, true);
```

### Visibility Modifiers

| Modifier | Meaning | Where |
|----------|---------|-------|
| `public` | Visible on-chain | Function parameters, return values |
| `private` | Encrypted (default for records) | Record fields |
| (none) | Private by default | Most contexts |

---

## 5. Programs, Functions & State

### Program Structure (Leo v4)

```leo
// Import external programs
import credits.aleo;
import other_program.aleo;

// Helper functions (outside program block)
fn compute_hash(a: field, b: field) -> field {
    return BHP256::hash_to_field(a + b);
}

program my_app.aleo {
    // Data types
    struct Bid {
        bidder: address,
        amount: u64,
    }

    record token {
        owner: address,
        amount: u64,
    }

    // Public on-chain state
    mapping balances: address => u64;
    mapping total_supply: bool => u64;

    // Constructor (for upgradability)
    @noupgrade
    constructor() {}

    // Entry function — callable externally
    fn mint(receiver: address, amount: u64) -> token {
        return token {
            owner: receiver,
            amount: amount,
        };
    }

    // Entry function with on-chain finalize
    fn transfer_public(receiver: address, amount: u64) -> Final {
        return finalize_transfer_public(self.caller, receiver, amount);
    }

    final fn finalize_transfer_public(sender: address, receiver: address, amount: u64) {
        let sender_bal: u64 = Mapping::get(balances, sender);
        assert(sender_bal >= amount);
        Mapping::set(balances, sender, sender_bal - amount);
        let recv_bal: u64 = Mapping::get_or_use(balances, receiver, 0u64);
        Mapping::set(balances, receiver, recv_bal + amount);
    }
}
```

### Function Types (Leo v4)

| Location | Signature | Was (v3) | Description |
|----------|-----------|----------|-------------|
| Inside `program {}` | `fn foo()` | `transition foo()` | Entry point — can be called externally, produces ZK proof |
| Inside `program {}` | `fn foo() -> Final` | `async transition foo() -> Future` | Entry + on-chain finalization |
| Inside `program {}` | `final fn foo()` | `async function foo()` | On-chain finalization logic |
| Outside `program {}` | `fn foo()` | `function foo()` / `inline foo()` | Helper — inlined at compile time |

### Special Variables

| Variable | Type | Context | Description |
|----------|------|---------|-------------|
| `self.caller` | `address` | Entry fn | Address of the direct caller |
| `self.signer` | `address` | Entry fn | Address of the transaction signer |
| `block.height` | `u32` | Final fn | Current block height |
| `network.id` | `u16` | Any | Network identifier |
| `self.edition` | `u16` | Constructor | Program edition number |
| `self.program_owner` | `address` | Constructor | Deployer address |
| `self.checksum` | `[u8; 32]` | Constructor | Program code checksum |

### Cross-Program Calls

```leo
import credits.aleo;
import oracle.aleo;

program my_app.aleo {
    fn do_transfer(receiver: address, amount: u64) -> Final {
        // Call external program (v4 uses :: instead of /)
        credits.aleo::transfer_public(receiver, amount);

        // Chain finalization
        let f1: Final = oracle.aleo::update_price(100u64);
        f1.run();

        return finalize_do_transfer(self.caller);
    }

    final fn finalize_do_transfer(caller: address) {
        // on-chain logic
    }
}
```

### Limitations

Programs have deployment limits enforced by snarkVM to ensure consistent block times:
- Constraints and variables counts are bounded
- A large portion comes from **hashing** (for all arguments/return values in function calls)
- Minimize passing large structs, arrays, or integers to reduce counts
- A transaction can contain up to **32 transitions** (one reserved for fees)

---

## 6. Operators & Expressions

Leo defaults to **checked arithmetic** — overflows and division by zero throw errors.

### Arithmetic

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `a + b` |
| `-` | Subtraction | `a - b` |
| `*` | Multiplication | `a * b` |
| `/` | Division | `a / b` |
| `%` | Modulo | `a % b` |
| `**` | Exponentiation | `a ** b` |

### Wrapping Variants

For cases where overflow wrapping is needed:

```leo
let result: u8 = a.add_wrapped(b);
let result: u8 = a.sub_wrapped(b);
let result: u8 = a.mul_wrapped(b);
let result: u8 = a.div_wrapped(b);
```

### Comparison

| Operator | Description |
|----------|-------------|
| `==` | Equal |
| `!=` | Not equal |
| `<` | Less than |
| `>` | Greater than |
| `<=` | Less than or equal |
| `>=` | Greater than or equal |

### Logical

| Operator | Description |
|----------|-------------|
| `&&` | Logical AND |
| `\|\|` | Logical OR |
| `!` | Logical NOT |

### Bitwise

| Operator | Description |
|----------|-------------|
| `&` | Bitwise AND |
| `\|` | Bitwise OR |
| `^` | Bitwise XOR |
| `<<` | Left shift |
| `>>` | Right shift |

### Assignment Operators

`=`, `+=`, `-=`, `*=`, `/=`, `%=`, `**=`, `<<=`, `>>=`, `&=`, `|=`, `^=`

### Operator Precedence (highest → lowest)

| Operators | Associativity |
|-----------|--------------|
| `!`, `-(unary)` | — |
| `**` | right to left |
| `*`, `/` | left to right |
| `+`, `-(binary)` | left to right |
| `<<`, `>>` | left to right |
| `&` | left to right |
| `\|` | left to right |
| `^` | left to right |
| `<`, `>`, `<=`, `>=` | — |
| `==`, `!=` | left to right |
| `&&` | left to right |
| `\|\|` | left to right |
| `=`, `+=`, `-=`, etc. | — |

### Core Functions

```leo
// Hashing
let h: field = BHP256::hash_to_field(data);
let h: field = Poseidon2::hash_to_field(data);
let h: field = Poseidon4::hash_to_field(data);
let h: address = BHP256::hash_to_address(data);
let h: group = Pedersen64::hash_to_group(data);
let h: field = Keccak256::hash_to_field(data);
let h: field = SHA3_256::hash_to_field(data);

// Commit (hiding + binding)
let c: field = BHP256::commit_to_field(data, randomizer);
let c: group = Pedersen64::commit_to_group(data, randomizer);

// Signature verification
let valid: bool = signature::verify(sig, addr, message);

// Type casting
let x: u64 = y as u64;

// Ternary
let result: u32 = condition ? value_if_true : value_if_false;

// Assert
assert(condition);
assert_eq(a, b);
assert_neq(a, b);
```

---

## 7. Interfaces & Dynamic Dispatch (v4)

**New in Leo 4.0** — Interfaces enable composable, modular programs.

### Defining an Interface

Interfaces are **compile-time structural contracts** — they declare what a program must expose:

```leo
interface Token {
    record token;

    fn transfer(
        input_record: token,
        to: address,
        amount: u64
    ) -> (token, token);
}
```

### Implementing an Interface

Programs opt in with `: InterfaceName`:

```leo
program my_token.aleo : Token {
    record token {
        owner: address,
        amount: u64,
    }

    fn transfer(
        input_record: token,
        to: address,
        amount: u64
    ) -> (token, token) {
        let remaining: u64 = input_record.amount - amount;
        let to_record: token = token { owner: to, amount: amount };
        let change: token = token { owner: input_record.owner, amount: remaining };
        return (to_record, change);
    }
}
```

### Interface Inheritance

```leo
interface Burnable : Token {
    fn burn(input_record: token);
}
```

### Dynamic Dispatch

Call interface methods on dynamically-resolved programs:

```leo
// `identifier` type holds a program ID at runtime
fn swap(token_program: identifier, input: dyn record, to: address, amt: u64) {
    // Dynamic call — resolved at runtime
    Token@(token_program)::transfer(input, to, amt);
}
```

- `identifier` — new type representing a program identifier
- `dyn record` — dynamically-typed record (matched at runtime)
- `Interface@(target)::method(args)` — dynamic dispatch syntax

---

## 8. Leo Libraries (v4)

**New in Leo 4.0** — Reusable code packages that don't compile to on-chain programs.

### Creating a Library

```bash
leo new --library my_lib
```

### Library Structure

```
my_lib/
├── program.json
└── src/
    └── lib.leo         # Entry point (not main.leo)
```

### Library Code

Libraries have **no `program {}` block** — they export reusable functions:

```leo
// lib.leo
fn min(a: u64, b: u64) -> u64 {
    return a < b ? a : b;
}

fn max(a: u64, b: u64) -> u64 {
    return a > b ? a : b;
}

fn clamp(value: u64, low: u64, high: u64) -> u64 {
    return min(max(value, low), high);
}
```

### Using Libraries

```leo
import my_lib;

program my_app.aleo {
    fn process(value: u64) -> u64 {
        return my_lib::clamp(value, 10u64, 100u64);
    }
}
```

### Features

- **Generic Functions** — Type parameters for reusable logic
- **Submodules** — Organize code into nested modules
- **No deployment** — Libraries are inlined at compile time, zero on-chain cost

---

## 9. Program Upgradability

Programs can be upgraded on-chain using the **constructor** mechanism.

### Upgrade Policies

| Annotation | Description |
|------------|-------------|
| `@noupgrade` | Program is immutable after first deployment |
| `@admin(address="aleo1...")` | Only the specified admin can upgrade |
| `@checksum(mapping="dao.aleo::approved_checksum", key="true")` | Governed by on-chain checksum (e.g., DAO vote) |
| `@custom` | Custom upgrade logic in constructor body |

### Constructor

The constructor is a **special immutable function** that runs on every deployment/upgrade:

```leo
program my_app.aleo {
    @admin(address="aleo1rhgdu77hgyqd3xjj8ucu3jj9r2p3lam3tc3h0nvv2d3k0rp2ca5sqsceh7")
    constructor() {
        // Auto-generated: assert(self.program_owner == admin_address)
    }
}
```

### Program Metadata (available in constructor)

| Operand | Type | Description |
|---------|------|-------------|
| `self.edition` | `u16` | Version number (starts at 0, incremented each upgrade) |
| `self.program_owner` | `address` | Address that submitted the deployment tx |
| `self.checksum` | `[u8; 32]` | Unique hash of the program's code |

### Upgrade Rules

An upgrade **CAN**:
- Change internal logic of existing entry `fn` bodies and `final {}` blocks
- Add new `struct`s, `record`s, `mapping`s, and `fn` declarations

An upgrade **CANNOT**:
- Change input/output signatures of existing entry `fn`
- Modify or delete existing `struct`, `record`, or `mapping`
- Delete any existing program component
- Change the `constructor` logic

### Upgrade Rules Table

| Component | Delete | Modify Signature | Add New |
|-----------|--------|-----------------|---------|
| `import` | ❌ | ❌ | ✅ |
| `struct` | ❌ | ❌ | ✅ |
| `record` | ❌ | ❌ | ✅ |
| `mapping` | ❌ | ❌ | ✅ |
| `fn` (helper) | ✅ | ✅ | ✅ |
| `fn` (entry) | ❌ | ❌ (logic only) | ✅ |
| `final fn` | ❌ | ❌ (logic only) | ✅ |
| `constructor` | ❌ | ❌ | ❌ |

### Custom Upgrade Example (Timelock)

```leo
program timelock_example.aleo {
    @custom
    constructor() {
        if self.edition > 0u16 {
            assert(block.height >= 1300u32);
        }
    }
}
```

### Legacy Programs

Programs deployed **before upgradability** (Leo < v3.1.0) are **permanently non-upgradable**. No migration path exists — deploy a new program and migrate users.

---

## 10. Leo CLI

### Installation

```bash
# Install Leo
curl -sSf https://install.provable.com/leo | sh

# Verify
leo --version
```

### Commands

| Command | Description |
|---------|-------------|
| `leo new <name>` | Create a new Leo project |
| `leo new --library <name>` | Create a new Leo library (v4) |
| `leo build` | Compile Leo to Aleo Instructions |
| `leo run <function> [inputs...]` | Execute locally (build + run) |
| `leo execute <function> [inputs...]` | Execute with proof generation |
| `leo deploy` | Deploy program to network |
| `leo test` | Run `@test` functions |
| `leo test --prove` | Run tests with proof generation |
| `leo add <program>` | Add a dependency |
| `leo remove <program>` | Remove a dependency |
| `leo clean` | Remove build artifacts |
| `leo update` | Update Leo to latest version |
| `leo account new` | Generate a new Aleo account |

### Deploy

```bash
# Set private key in .env
echo "PRIVATE_KEY=APrivateKey1zkp..." > .env

# Deploy to testnet
leo deploy --network testnet

# Deploy to mainnet
leo deploy --network mainnet

# With custom endpoint
leo deploy --endpoint https://api.provable.com/v2

# With priority fee
leo deploy --priority-fee 1000
```

### Execute

```bash
# Execute locally (no proof, fast)
leo run transfer "aleo1..." 100u64

# Execute with proof (for broadcasting)
leo execute transfer "aleo1..." 100u64 --network testnet --broadcast

# With private fee
leo execute transfer "aleo1..." 100u64 --private-fee --record "{...}"
```

### Environment File (`.env`)

```env
NETWORK=testnet
PRIVATE_KEY=APrivateKey1zkp...
ENDPOINT=https://api.provable.com/v2
```

---

## 11. Testing

### Writing Tests (Leo v4)

Tests are `@test fn` declarations **inside** the `program {}` block:

```leo
program my_app.aleo {
    fn add(a: u32, b: u32) -> u32 {
        return a + b;
    }

    @test
    fn test_add() {
        let result: u32 = add(2u32, 3u32);
        assert_eq(result, 5u32);
    }

    @test
    fn test_overflow() {
        // This should fail — tests can also verify failure conditions
        let result: u32 = add(4294967295u32, 1u32);
    }
}
```

### Running Tests

```bash
# Run all tests (no proof generation — fast)
leo test

# Run tests with proof generation
leo test --prove

# Non-zero exit code on failure (CI-friendly)
echo $?  # 0 = pass, non-zero = fail
```

### Key Changes from v3

- `@test script foo()` → `@test fn foo()` inside `program {}`
- No proof generation by default (use `--prove` flag)
- Non-zero exit code on failure
- `leo debug` removed — use `leo test`

---

## 12. Aleo Accounts

An Aleo account has three components:

### Account Structure

```
Private Key → View Key → Address
```

| Component | Format | Prefix | Length | Purpose |
|-----------|--------|--------|--------|---------|
| **Private Key** | Base58 | `APrivateKey1` | 59 chars | Sign transactions, authorize state changes |
| **View Key** | Base58 | `AViewKey1` | 53 chars | Decrypt records, audit account history |
| **Address** | Bech32 (lowercase) | `aleo1` | 63 chars | Public identifier, receive records |

### Examples

```
Private Key:  APrivateKey1zkp4X9ApjTb7Rv8EABfZRugXBhbPzCL245GyNtYJP5GYY2k
View Key:     AViewKey1nKB4qr9b5gK8wQvmM5sTPEuBwshtDdkCZB1SPWppAG9Y
Address:      aleo1dg722m22fzpz6xjdrvl9tzu5t68zmypj5p74khlqcac0gvednygqxaax0j
```

### Key Derivation

1. **Private Key**: Sample 32-byte `seed` → derive `sk_sig` and `r_sig` via Poseidon hash
2. **View Key**: `view_key = sk_sig + r_sig + HashToScalar(sk_sig * G || r_sig * G)`
3. **Address**: `address = view_key * G` (where `G` is the generator point)

### Security

- **Never share your private key**
- View key can be shared with trusted auditors for record decryption
- Address is public — safe to share
- **Compute keys** allow third parties to generate transactions on your behalf without exposing the private key
- Create accounts on **offline/disconnected** devices for maximum security

### Creating an Account

```bash
# Using Leo CLI
leo account new

# Using SDK
import { Account } from '@provablehq/sdk/testnet.js';
const account = new Account();
console.log(account.privateKey());
console.log(account.viewKey());
console.log(account.address());
```

---

## 13. Records (UTXO Model)

Records are the core data structure for encoding **user assets and application state** with privacy.

### Record Structure

| Field | Type | Description |
|-------|------|-------------|
| `owner` | `address` | The record owner (authorized to spend) |
| `data` | `Map<Identifier, Entry>` | Arbitrary application data (each entry is `public` or `private`) |
| `_nonce` | `group` | Serial number nonce (ensures uniqueness) |
| `version` | `u8` | Record version (`0` = legacy, `1` = current) |

### Example Record

```
{
  owner: aleo13ssze66adjjkt795z9u5wpq8h6kn0y2657726h4h3e3wfnez4vqsm3008q.private,
  amount: 100u64.private,
  _nonce: 5861592911433819692697358191094794940442348980903696700646555355124091569429group.public,
  version: 1u8.public
}
```

### Record Model vs Account Model

| Feature | Account Model (Ethereum) | Record Model (Aleo) |
|---------|-------------------------|---------------------|
| State location | Global mapping by address | Encrypted on-chain per-record |
| Privacy | All state visible | Encrypted by default |
| Concurrency | Sequential (per account) | Parallel (independent records) |
| State update | Modify in-place | Consume old → produce new (UTXO) |
| Identity | Addresses visible | Addresses encrypted |

### Record Lifecycle

1. **Creation**: A transition function `output`s a new record
2. **Encryption**: Record data encrypted with owner's address
3. **On-chain**: Appears on blockchain as ciphertext (only owner can decrypt)
4. **Spending**: Used as input to a transition → marked as spent (serial number revealed)
5. **Serial Numbers**: Prevent double-spending without revealing which record was spent

### Record Versions

| Version | Features |
|---------|----------|
| **v0** | BHP hash commitment, no sender ciphertext, view key decryption only |
| **v1** (current) | BHP commitment + nonce, sender ciphertext, record view key decryption, required after Consensus V8 |

### Credits Record

The native fee/transfer record:

```leo
record credits {
    owner: address,
    microcredits: u64,
}
```

---

## 14. Transactions

A transaction publishes state transitions on the ledger. It contains one or more **transitions**.

### Transaction Types

| Type | Description |
|------|-------------|
| **Execute** | Call a program function on-chain |
| **Deploy** | Publish a new program to the network |
| **Fee** | Standalone fee (for rejected transactions) |

### Execute Transaction Structure

```json
{
  "type": "execute",
  "id": "at1...",
  "execution": {
    "global_state_root": "...",
    "transitions": [...],
    "proof": "..."
  },
  "fee": { ... }
}
```

### Transaction Lifecycle

```
User Initiates (Private Key + Inputs)
    ↓
Transaction Type (Execute / Deploy)
    ↓
Download Programs & SRS (or use cached)
    ↓
Authorization (Sign Function Call)
    ↓
Proving Strategy:
    ├─ Local Proving (generate proofs on device)
    ├─ Delegated Proving - Self-Paid Fee
    └─ Delegated Proving - Fee Master (prover pays)
    ↓
Broadcast to Validators
    ↓
Mempool (Unconfirmed Transaction)
    ↓
Decision:
    ├─ Accepted  → Add to Block, Finalize State Updates
    ├─ Rejected  → Fee charged, execution discarded
    └─ Aborted   → Nothing included in block
    ↓
Consensus Check (AleoBFT) → Commit Block
```

### Transaction Status

| Status | Description |
|--------|-------------|
| **Accepted** | Execution/deployment succeeded, fee consumed |
| **Rejected** | Logic failed, fee charged as standalone fee tx |
| **Aborted** | Both logic and fee failed, no block inclusion |

### Building Transactions

**With Leo CLI:**

```bash
# Execute
leo execute transfer "aleo1..." 100u64 --network testnet --broadcast

# Deploy
leo deploy --network testnet --broadcast
```

**With SDK:**

```typescript
import { AleoNetworkClient } from '@provablehq/sdk/mainnet.js';

const net = new AleoNetworkClient('https://api.provable.com/v2');
const txId = 'at14v8nt94d7xmsp3dq2glpzft6xw3x42ne753mlt8uenn8zw76dsqqc65jnf';

// Check status
const status = await net.getConfirmedTransaction(txId);
console.log(status.status); // "accepted" | "rejected"

// Find block hash for tx
const blockHash = await net.fetchData('/find/blockHash/' + txId);
const block = await net.getBlockByHash(blockHash);
```

### Fee Calculation

- Based on **transaction size** and **operation complexity**
- Paid in **Aleo Credits** (public or private via records)
- Optional **priority fee** for faster inclusion

---

## 15. Provable SDK (`@provablehq/sdk`)

The official TypeScript/JavaScript SDK for building Aleo applications.

### Installation

```bash
npm install @provablehq/sdk
# or
yarn add @provablehq/sdk
```

### Configuration

```json
// package.json
{
  "type": "module"
}
```

```javascript
// webpack.config.js
{
  experiments: {
    asyncWebAssembly: true,
    topLevelAwait: true,
  }
}
```

### Network Selection

```typescript
// Mainnet
import { Account, ProgramManager, AleoNetworkClient } from '@provablehq/sdk/mainnet.js';

// Testnet
import { Account, ProgramManager, AleoNetworkClient } from '@provablehq/sdk/testnet.js';

// Default (testnet if not specified)
import { Account } from '@provablehq/sdk';
```

> **Note**: Mainnet and Testnet are NOT interoperable. Transactions built for one network are invalid on the other.

### Initialize WebAssembly (Recommended)

```typescript
import { initThreadPool } from '@provablehq/sdk/mainnet.js';

// Enable multithreaded WASM (call once at startup)
await initThreadPool();
```

> Requires Node.js 20+ (22+ recommended).

### Core Classes

#### Account

```typescript
import { Account } from '@provablehq/sdk/testnet.js';

// Generate new account
const account = new Account();

// From existing private key
const account = new Account({ privateKey: 'APrivateKey1zkp...' });

console.log(account.privateKey());  // APrivateKey1zkp...
console.log(account.viewKey());     // AViewKey1...
console.log(account.address());     // aleo1...
```

#### AleoNetworkClient

```typescript
import { AleoNetworkClient } from '@provablehq/sdk/testnet.js';

const client = new AleoNetworkClient('https://api.provable.com/v2');

// Get latest block height
const height = await client.getLatestBlockHeight();

// Get program source
const program = await client.getProgram('credits.aleo');

// Get mapping value
const balance = await client.getProgramMappingValue(
  'credits.aleo',
  'account',
  'aleo1...'
);

// Submit transaction
const txId = await client.submitTransaction(transaction);

// Wait for confirmation
const confirmed = await client.waitForTransactionConfirmation(txId);
```

#### ProgramManager

```typescript
import {
  Account,
  AleoKeyProvider,
  ProgramManager,
  NetworkRecordProvider,
  AleoNetworkClient,
} from '@provablehq/sdk/testnet.js';

const host = 'https://api.provable.com/v2';
const account = new Account({ privateKey: process.env.PRIVATE_KEY });
const networkClient = new AleoNetworkClient(host);
const keyProvider = new AleoKeyProvider();
const recordProvider = new NetworkRecordProvider(account, networkClient);
keyProvider.useCache(true);

const programManager = new ProgramManager(host, keyProvider, recordProvider);
programManager.setAccount(account);

// Build a proving request
const provingRequest = await programManager.provingRequest({
  programName: 'credits.aleo',
  functionName: 'transfer_public',
  priorityFee: 0,
  privateFee: false,
  inputs: ['aleo1...', '10000000u64'],
  broadcast: false,
});
```

### SDK Packages

| Package | Description |
|---------|-------------|
| `@provablehq/sdk` | Core TypeScript/JavaScript library |
| `@provablehq/wasm` | Rust → WebAssembly compilation (used internally) |
| `create-leo-app` | Scaffolding tool — React, Next.js, Node templates |

---

## 16. Delegated Proving Service (DPS)

Delegated proving allows offloading proof generation to Provable's infrastructure running in a **Trusted Execution Environment (TEE)**.

### Why Use DPS?

- Local proving is **slow** (minutes) and **RAM-intensive** (GBs)
- DPS generates proofs quickly in secure hardware
- Encrypted flow ensures **nobody sees your inputs** — decrypted only inside TEE

### Flow (Encrypted)

```
Client                          SDK                         Delegated Prover (TEE)
  │                              │                               │
  ├── GET /pubkey ──────────────────────────────────────────────→│
  │←── { key_id, public_key } ──────────────────────────────────┤
  │                              │                               │
  ├── encryptProvingRequest(publicKey, provingRequest) ─────────→│
  │←── ciphertext (base64) ─────┤                               │
  │                              │                               │
  ├── POST /prove/encrypted { key_id, ciphertext } ────────────→│
  │                              │         Decrypt, prove, discard
  │←── { transaction, broadcast_result } ───────────────────────┤
```

### Authentication

1. **Register a consumer**: `POST {baseUrl}/consumers` → get `apiKey` + `consumerId`
2. **Get JWT**: `POST https://api.provable.com/jwts/{consumerId}` with `X-Provable-API-Key: <apiKey>`
3. SDK handles JWT refresh automatically when configured

### Base URLs

| Service | URL Pattern |
|---------|-------------|
| **API** | `https://api.provable.com/v2` |
| **Prover** | `https://api.provable.com/prove/{network}` |

### Routes

| Path | Method | Description |
|------|--------|-------------|
| `/pubkey` | GET | Get ephemeral X25519 public key |
| `/prove/encrypted` | POST | Submit encrypted proving request |
| `/prove` | POST | Submit unencrypted proving request |

### Using the SDK

```typescript
import {
  Account,
  AleoKeyProvider,
  ProgramManager,
  NetworkRecordProvider,
  AleoNetworkClient,
} from '@provablehq/sdk/mainnet.js';

const host = 'https://api.provable.com/v2';
const account = new Account({ privateKey: process.env.PRIVATE_KEY });
const networkClient = new AleoNetworkClient(host);
const keyProvider = new AleoKeyProvider();
const recordProvider = new NetworkRecordProvider(account, networkClient);
keyProvider.useCache(true);

const programManager = new ProgramManager(host, keyProvider, recordProvider);
programManager.setAccount(account);

// Build proving request
const provingRequest = await programManager.provingRequest({
  programName: 'credits.aleo',
  functionName: 'transfer_public',
  priorityFee: 0,
  privateFee: false,
  inputs: [
    'aleo1vwls2ete8dk8uu2kmkmzumd7q38fvshrht8hlc0a5362uq8ftgyqnm3w08',
    '10000000u64',
  ],
  broadcast: false,
});

// Set prover endpoint
networkClient.setProverUri('https://api.provable.com/prove');

// Submit with encryption
const { transaction, broadcast_result } = await networkClient.submitProvingRequest({
  provingRequest,
  dpsPrivacy: true,
  apiKey: process.env.PROVABLE_API_KEY,
  consumerId: process.env.PROVABLE_CONSUMER_ID,
});

console.log('Transaction ID:', transaction?.id);
console.log('Broadcast status:', broadcast_result?.status);

// If broadcast was false, submit manually
if (transaction) {
  const transactionId = await networkClient.submitTransaction(transaction);
  const confirmed = await networkClient.waitForTransactionConfirmation(transactionId);
  console.log('Confirmed:', confirmed);
}
```

### Using Custom JavaScript

```typescript
import { encryptProvingRequest } from '@provablehq/sdk/mainnet.js';

const proverBase = 'https://api.provable.com/prove/mainnet';

// Step 1: Get ephemeral public key
const pubkeyRes = await fetch(`${proverBase}/pubkey`, {
  method: 'GET',
  headers: { 'Content-Type': 'application/json', Authorization: jwt },
  credentials: 'include',
});
const pubkey = await pubkeyRes.json();
const cookie = pubkeyRes.headers.get('set-cookie'); // Node.js only

// Step 2: Encrypt proving request
const ciphertext = encryptProvingRequest(pubkey.public_key, provingRequest);

// Step 3: POST encrypted request
const res = await fetch(`${proverBase}/prove/encrypted`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: jwt,
    ...(cookie ? { Cookie: cookie } : {}),
  },
  credentials: 'include',
  body: JSON.stringify({ key_id: pubkey.key_id, ciphertext }),
});

const { transaction, broadcast_result } = await res.json();
```

### Best Practices

1. **Prefer encrypted flow** for production
2. Use `submitProvingRequestSafe()` for error branching without try/catch
3. Supply `apiKey` + `consumerId` for automatic JWT refresh
4. Set `useFeeMaster: true` when prover pays fees on your behalf
5. Pass `RecordScanner` into `ProgramManager` for automatic fee record resolution

> **Important**: `submitProvingRequest` does NOT broadcast by default. Set `broadcast: true` or call `networkClient.submitTransaction(transaction)` manually.

---

## 17. Record Scanning Service (RSS)

The RSS indexes the Aleo ledger and finds records belonging to specific accounts.

### How It Works

1. User provides **encrypted ViewKey** to the scanner (runs inside TEE)
2. Scanner decrypts ViewKey **only inside secure enclave**
3. Scans all blockchain inputs/outputs attempting decryption
4. Returns owned records to the user

### Base URLs

| Network | URL |
|---------|-----|
| Mainnet | `https://api.provable.com/scanner/mainnet` |
| Testnet | `https://api.provable.com/scanner/testnet` |

### Routes

| Path | Method | Description | Body |
|------|--------|-------------|------|
| `/pubkey` | GET | Ephemeral public key for encryption | — |
| `/register/encrypted` | POST | Register view key (encrypted) | `{ key_id, ciphertext }` |
| `/records/owned` | POST | Get owned records | `{ uuid, unspent?, filter? }` |

### Using the SDK

```typescript
import { Account, RecordScanner } from '@provablehq/sdk/mainnet.js';

const account = new Account({ privateKey: 'APrivateKey1zkp...' });
const recordScanner = new RecordScanner({
  url: 'https://api.provable.com/scanner',
});
await recordScanner.setApiKey(process.env.RECORD_SCANNER_API_KEY);
await recordScanner.setConsumerId(process.env.RECORD_SCANNER_CONSUMER_ID);

// Register (encrypted — recommended)
const regResult = await recordScanner.registerEncrypted(account.viewKey(), 0);
if (!regResult.ok) {
  throw new Error(regResult.error?.message ?? `Registration failed: ${regResult.status}`);
}
const uuid = regResult.data.uuid;

// Find unspent credits records
const records = await recordScanner.findRecords({
  uuid,
  unspent: true,
  filter: { program: 'credits.aleo', record: 'credits' },
});
```

### Using Custom JavaScript

```typescript
import { encryptRegistrationRequest, Account } from '@provablehq/sdk/mainnet.js';

const scannerBase = 'https://api.provable.com/scanner/mainnet';
const account = new Account({ privateKey: 'APrivateKey1zkp...' });

// Step 1: Get ephemeral public key
const pubkeyRes = await fetch(`${scannerBase}/pubkey`, { method: 'GET' });
const pubkey = await pubkeyRes.json(); // { key_id, public_key }

// Step 2: Encrypt and register
const ciphertext = encryptRegistrationRequest(pubkey.public_key, account.viewKey(), 0);
const registerRes = await fetch(`${scannerBase}/register/encrypted`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key_id: pubkey.key_id, ciphertext }),
});
const { uuid } = await registerRes.json();

// Step 3: Get owned records
const ownedRes = await fetch(`${scannerBase}/records/owned`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uuid, unspent: true }),
});
const records = await ownedRes.json();
```

### Best Practices

1. **Prefer encrypted registration** for production
2. Store and reuse the `uuid` for subsequent queries
3. On **422 from `/records/owned`**, re-register and retry
4. Pass `RecordScanner` into `ProgramManager` for automatic fee record resolution

---

## 18. Provable API v2

RESTful endpoints to query and interact with the Aleo blockchain.

**Base URL**: `https://api.provable.com/v2/{network}`

### Rate Limits

| Limit | Value |
|-------|-------|
| Requests per second | 5 |
| Requests per day | 100,000 |

Contact `explorer@provable.com` for higher limits.

---

### SnarkOS Core Endpoints

#### Blocks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/block/latest` | GET | Latest block |
| `/block/height/latest` | GET | Latest block height |
| `/block/hash/latest` | GET | Latest block hash |
| `/block/{heightOrHash}` | GET | Block by height or hash |
| `/find/blockHash/{txId}` | GET | Block hash by transaction ID |
| `/block/{height}/transactions` | GET | Transactions by block height |
| `/blocks?start={}&end={}` | GET | Blocks in range |
| `/stateRoot/latest` | GET | Latest state root |
| `/stateRoot/{height}` | GET | State root by height |
| `/find/blockHeight/{stateRoot}` | GET | Block height by state root |
| `/statePath/{commitment}` | GET | State path by commitment |
| `/height/{hash}` | GET | Height by hash |
| `/block/{height}/history/{mapping}` | GET | Block history |

#### Transactions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/transaction/{txId}` | GET | Transaction by ID |
| `/find/transactionID/{transitionId}` | GET | TX ID by transition ID |
| `/transaction/confirmed/{txId}` | GET | Confirmed transaction |
| `/transaction/unconfirmed/{txId}` | GET | Unconfirmed transaction |
| `/transaction/broadcast` | POST | Broadcast transaction |

#### Committee

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/committee/latest` | GET | Latest committee |
| `/committee/{height}` | GET | Committee by height |
| `/delegators/{validator}` | GET | Delegators by validator |

#### Programs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/program/{programId}` | GET | Program source by ID |
| `/program/{programId}/mappings` | GET | List program mappings |
| `/program/{programId}/mapping/{mapping}/{key}` | GET | Get mapping value |
| `/program/{programId}/latest/edition` | GET | Latest program edition |
| `/program/{programId}/{edition}` | GET | Program by edition |
| `/find/transitionID/{inputOrOutputId}` | GET | Transition by I/O ID |
| `/find/transactionID/deployment/{programId}` | GET | Deployment TX ID |

#### Solutions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/solution/broadcast` | POST | Broadcast prover solution |

---

### Public API (Explorer)

#### Blocks

| Endpoint | Method |
|----------|--------|
| `/explorer/blocks/latest` | GET |
| `/explorer/blocks/latest/hash` | GET |
| `/explorer/blocks/latest/height` | GET |
| `/explorer/blocks/{height}` | GET |
| `/explorer/blocks/{hash}` | GET |
| `/explorer/blocks/latest/stateRoot` | GET |

#### Transactions

| Endpoint | Method |
|----------|--------|
| `/transactions/address/{address}` | GET |
| `/explorer/transactions/{txId}` | GET |
| `/explorer/transactions/confirmed/{txId}` | GET |
| `/explorer/transactions/unconfirmed/{txId}` | GET |
| `/explorer/transactions/block/{height}` | GET |
| `/explorer/transactions/block/{hash}` | GET |
| `/explorer/transitions/{address}` | GET |
| `/explorer/transactions/broadcast` | POST |

#### Programs

| Endpoint | Method |
|----------|--------|
| `/explorer/programs/{programId}` | GET |
| `/explorer/programs/{programId}/latest/calls` | GET |
| `/explorer/programs/{programId}/latest/edition` | GET |
| `/explorer/programs/{programId}/mappings` | GET |
| `/explorer/programs/{programId}/mapping/{mapping}/{key}` | GET |

#### Metrics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/blocks/summary/latest` | GET | Latest blocks summary |
| `/metrics/transactions/daily` | GET | Daily transaction metrics |
| `/metrics/programs` | GET | Program metrics |
| `/explorer/metrics/puzzle-rewards/monthly` | GET | Monthly puzzle rewards |
| `/explorer/metrics/apy/monthly` | GET | Monthly APY |
| `/explorer/metrics/validators/apy` | GET | Current validator APY |
| `/explorer/metrics/participation` | GET | Validator participation |
| `/metrics/provers/total` | GET | Total prover metrics |
| `/metrics/apy` | GET | Last 24h APY |

#### Supply

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/latest/total-supply` | GET | Total supply (credits) |
| `/supply/total-supply` | GET | Total supply (microcredits) |
| `/supply/circulating-supply` | GET | Circulating supply (microcredits) |
| `/supply/circulating-supply/credits` | GET | Circulating supply (credits) |

#### DeFi

| Endpoint | Method |
|----------|--------|
| `/defi/total-value` | GET |
| `/tokens` | GET |
| `/tokens/{details}` | GET |

#### Staking & Proving

| Endpoint | Method |
|----------|--------|
| `/delegators/latest` | GET |
| `/provers` | GET |

#### Address

| Endpoint | Method |
|----------|--------|
| `/earnings/{address}` | GET |
| `/provers/solutions/{address}` | GET |
| `/network/provers/rewards/total/{address}` | GET |

---

### Service Endpoints

#### Delegated Proving

| Endpoint | Method |
|----------|--------|
| `/prove` | POST |

#### Record Scanning

| Endpoint | Method |
|----------|--------|
| `/scanner/register` | POST |
| `/scanner/records/owned` | POST |
| `/scanner/records/tags` | GET |
| `/scanner/records/sns` | GET |
| `/scanner/status` | GET |
| `/scanner/records/encrypted` | GET |

#### Auth

| Endpoint | Method |
|----------|--------|
| `/auth/register` | POST |
| `/jwts/{consumerId}` | POST |

---

### Usage Examples

```bash
# Get latest block height
curl https://api.provable.com/v2/mainnet/block/height/latest

# Get program source
curl https://api.provable.com/v2/mainnet/program/credits.aleo

# Get mapping value (account balance)
curl https://api.provable.com/v2/mainnet/program/credits.aleo/mapping/account/aleo1...

# Get confirmed transaction
curl https://api.provable.com/v2/mainnet/transaction/confirmed/at1...

# Broadcast transaction
curl -X POST https://api.provable.com/v2/mainnet/transaction/broadcast \
  -H "Content-Type: application/json" \
  -d '{"...transaction JSON..."}'
```

---

## 19. Provable API v1

Legacy API — still operational but v2 is recommended.

**Base URL**: `https://api.provable.com/v1/{network}`

### Endpoints

#### Blocks

| Endpoint | Description |
|----------|-------------|
| `/latest/block` | Latest block |
| `/blocks?start={}&end={}` | Blocks in range |
| `/latest/height` | Latest block height |
| `/latest/hash` | Latest block hash |
| `/block/{heightOrHash}` | Block by height or hash |
| `/find/blockHash/{txId}` | Block hash by TX ID |
| `/latest/stateRoot` | Latest state root |
| `/stateRoot/{height}` | State root by height |
| `/find/blockHeight/{stateRoot}` | Block height by state root |
| `/statePath/{commitment}` | State path by commitment |
| `/height/{hash}` | Height by hash |
| `/block/{height}/history/{mapping}` | Block history |

#### Committee

| Endpoint | Description |
|----------|-------------|
| `/committee/latest` | Latest committee |
| `/committee/{height}` | Committee by height |
| `/delegators/{validator}` | Delegators by validator |

#### Programs

| Endpoint | Description |
|----------|-------------|
| `/program/{programId}` | Program by ID |
| `/program/{programId}/latest/edition` | Latest edition |
| `/program/{programId}/{edition}` | Program by edition |
| `/program/{programId}/mappings` | Program mappings |
| `/program/{programId}/mapping/{name}/{key}` | Mapping value |
| `/find/transitionID/{inputOrOutputId}` | Transition by I/O ID |
| `/find/transactionID/deployment/{programId}` | Deployment TX |

#### Solutions

| Endpoint | Description |
|----------|-------------|
| `/solution/broadcast` | Broadcast solution |

#### Supply

| Endpoint | Description |
|----------|-------------|
| `/supply/total` | Total supply (microcredits) |
| `/latest/total-supply` | Latest total supply |
| `/supply/circulating` | Circulating supply |
| `/latest/circulating-supply` | Latest circulating supply |

#### Transactions

| Endpoint | Description |
|----------|-------------|
| `/transaction/{txId}` | Transaction by ID |
| `/find/transactionID/{transitionId}` | TX by transition ID |
| `/transaction/confirmed/{txId}` | Confirmed TX |
| `/transaction/unconfirmed/{txId}` | Unconfirmed TX |
| `/block/{heightOrHash}/transactions` | TXs by block |
| `/transaction/broadcast` | Broadcast TX |

### Usage Example

```bash
curl -L 'https://api.provable.com/v1/mainnet/latest/block'
```

---

## 20. SnarkOS & SnarkVM

### SnarkOS

**Repository**: [github.com/ProvableHQ/snarkOS](https://github.com/ProvableHQ/snarkOS)

SnarkOS is the **decentralized operating system** for Aleo. It forms the backbone of the network by validating transactions, producing blocks, and maintaining consensus.

#### Node Types

| Type | Description |
|------|-------------|
| **Validator** | Participates in consensus (staking required) |
| **Prover** | Generates solutions (coinbase puzzle) |
| **Client** | Lightweight node for querying state |

#### Running a Node

```bash
# Clone and build
git clone https://github.com/ProvableHQ/snarkOS.git
cd snarkOS
cargo build --release

# Run a client node
./target/release/snarkos start --client

# Run a validator
./target/release/snarkos start --validator --private-key APrivateKey1zkp...
```

### SnarkVM

**Repository**: [github.com/ProvableHQ/snarkVM](https://github.com/ProvableHQ/snarkVM)

SnarkVM is the **virtual machine** that executes Aleo programs and generates zero-knowledge proofs.

#### Components

| Component | Description |
|-----------|-------------|
| **Console** | Account management, program execution |
| **Circuit** | Circuit construction for ZK proofs |
| **Synthesizer** | Key generation, proof synthesis |
| **Algorithms** | Cryptographic primitives (Poseidon, BHP, Pedersen) |
| **Curves** | Elliptic curve operations (BLS12-377, Edwards) |

#### Cryptographic Primitives

| Primitive | Variants | Use |
|-----------|----------|-----|
| **BHP** | BHP256, BHP512, BHP768, BHP1024 | Hashing, commitments |
| **Pedersen** | Pedersen64, Pedersen128 | Commitments |
| **Poseidon** | Poseidon2, Poseidon4, Poseidon8 | Hashing (ZK-friendly) |
| **Keccak** | Keccak256, Keccak384, Keccak512 | Hashing (EVM compat) |
| **SHA3** | SHA3_256, SHA3_384, SHA3_512 | Hashing |

---

## 21. Ecosystem & Resources

### Official Links

| Resource | URL |
|----------|-----|
| **Aleo Website** | [aleo.org](https://aleo.org) |
| **Leo Docs** | [docs.leo-lang.org](https://docs.leo-lang.org) |
| **Aleo Developer Docs** | [developer.aleo.org](https://developer.aleo.org) |
| **Provable API Docs** | [docs.provable.com](https://docs.provable.com) |
| **Leo Playground** | [play.leo-lang.org](https://play.leo-lang.org) |
| **Block Explorer** | [explorer.provable.com](https://explorer.provable.com) |

### GitHub Repositories

| Repository | Description |
|------------|-------------|
| [ProvableHQ/leo](https://github.com/ProvableHQ/leo) | Leo compiler |
| [ProvableHQ/snarkOS](https://github.com/ProvableHQ/snarkOS) | Aleo node software |
| [ProvableHQ/snarkVM](https://github.com/ProvableHQ/snarkVM) | Aleo virtual machine |
| [ProvableHQ/sdk](https://github.com/ProvableHQ/sdk) | TypeScript/JavaScript SDK |
| [ProvableHQ/leo-docs-source](https://github.com/ProvableHQ/leo-docs-source) | Leo documentation |
| [AleoNet/welcome](https://github.com/AleoNet/welcome) | Developer docs source |
| [AleoNet/workshop](https://github.com/AleoNet/workshop) | Workshop examples (81+ snippets) |
| [ProvableHQ/leo-examples](https://github.com/ProvableHQ/leo-examples) | Leo example programs |

### Community

| Channel | Link |
|---------|------|
| **Discord** | [discord.com/invite/aleo](https://discord.com/invite/aleo) |
| **X (Twitter)** | [@AleoHQ](https://x.com/AleoHQ), [@ProvableHQ](https://x.com/ProvableHQ), [@leolangzk](https://x.com/leolangzk) |
| **YouTube** | [youtube.com/@aleofoundation](https://youtube.com/@aleofoundation) |
| **Governance** | [vote.aleo.org](https://vote.aleo.org) |

### SDK Ecosystem

| Tool | Description | Install |
|------|-------------|---------|
| `@provablehq/sdk` | Core TS/JS library | `npm install @provablehq/sdk` |
| `@provablehq/wasm` | Rust→WASM low-level | Used internally by SDK |
| `create-leo-app` | Full-stack scaffolding | `npx create-leo-app@latest` |
| Leo VS Code | Language support | [VS Code Marketplace](https://marketplace.visualstudio.com) |
| Leo Sublime Text 3 | Language support | Package Control |
| Leo IntelliJ | Language support | JetBrains Marketplace |

### Quick Start Template

```bash
# Create a new full-stack app
npx create-leo-app@latest my-app

# Or create a Leo program only
leo new my_program
cd my_program

# Write your program in src/main.leo
# Build
leo build

# Test
leo test

# Deploy
echo "PRIVATE_KEY=APrivateKey1zkp..." > .env
leo deploy --network testnet
```

---

## Quick Reference Card

### Leo v4 Cheat Sheet

```leo
// ═══════════════════════════════════════════
// LEO v4 QUICK REFERENCE
// ═══════════════════════════════════════════

// Helper function (outside program block)
fn helper(x: u64) -> u64 { return x * 2u64; }

program my_app.aleo {

    // ─── Data Types ───
    struct Info { name: field, value: u64 }
    record token { owner: address, amount: u64 }
    mapping balances: address => u64;

    // ─── Constructor (upgradability) ───
    @noupgrade
    constructor() {}

    // ─── Entry Function (was `transition`) ───
    fn mint(receiver: address, amount: u64) -> token {
        return token { owner: receiver, amount: amount };
    }

    // ─── Entry + Finalize (was `async transition`) ───
    fn transfer_public(to: address, amt: u64) -> Final {
        return fin_transfer(self.caller, to, amt);
    }

    // ─── On-Chain Logic (was `async function`) ───
    final fn fin_transfer(from: address, to: address, amt: u64) {
        let bal: u64 = Mapping::get(balances, from);
        assert(bal >= amt);
        Mapping::set(balances, from, bal - amt);
        Mapping::set(balances, to,
            Mapping::get_or_use(balances, to, 0u64) + amt);
    }

    // ─── External Call (:: instead of /) ───
    fn wrap_transfer(to: address, amt: u64) -> Final {
        let f: Final = credits.aleo::transfer_public(to, amt);
        f.run();  // was f.await()
        return fin_wrap(self.caller);
    }

    final fn fin_wrap(caller: address) { /* ... */ }

    // ─── Tests ───
    @test
    fn test_mint() {
        let t: token = mint(aleo1qnr4dkkvkgfqph0vzc3y6z2eu975wnpz2925ntjccd5cfqxtyu8s7pyjh9, 100u64);
        assert_eq(t.amount, 100u64);
    }
}
```

### API Quick Reference

```bash
# ─── Provable API v2 ───
BASE="https://api.provable.com/v2/testnet"

# Block height
curl $BASE/block/height/latest

# Program source
curl $BASE/program/my_program.aleo

# Mapping value
curl $BASE/program/credits.aleo/mapping/account/aleo1...

# Broadcast transaction
curl -X POST $BASE/transaction/broadcast -H "Content-Type: application/json" -d @tx.json
```

### SDK Quick Reference

```typescript
import {
  Account, AleoNetworkClient, ProgramManager,
  AleoKeyProvider, NetworkRecordProvider, RecordScanner,
  initThreadPool
} from '@provablehq/sdk/testnet.js';

await initThreadPool();

const account = new Account({ privateKey: 'APrivateKey1zkp...' });
const client  = new AleoNetworkClient('https://api.provable.com/v2');
const keys    = new AleoKeyProvider();
const records = new NetworkRecordProvider(account, client);
const pm      = new ProgramManager('https://api.provable.com/v2', keys, records);
pm.setAccount(account);

// Query
const height  = await client.getLatestBlockHeight();
const balance = await client.getProgramMappingValue('credits.aleo', 'account', account.address());

// Delegated Proving
client.setProverUri('https://api.provable.com/prove');
const req = await pm.provingRequest({ programName: 'my_app.aleo', functionName: 'transfer', inputs: [...], broadcast: true });
const res = await client.submitProvingRequest({ provingRequest: req, dpsPrivacy: true, apiKey: '...', consumerId: '...' });
```

---

*Built for the VEIL STRIKE project — a zero-knowledge prediction market on Aleo.*
