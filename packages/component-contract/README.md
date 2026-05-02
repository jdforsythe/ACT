# @act-spec/component-contract

PRD-300 component-instrumentation contract framework for ACT v0.1. Defines the canonical contract object every framework binding (PRD-301 React, PRD-302 Vue, PRD-303 Angular) desugars into, the page-level aggregation rule, the variant emission protocol, and the binding capability matrix.

This is a framework package. It emits no nodes itself; it provides the types, the desugaring helpers (static-field / hook / decorator), the page-level aggregation walk, the variant replay loop, the placeholder + secret-redaction helpers, and the contract-version gate that the leaf bindings 301/302/303 implement against.

Source of truth: `prd/300-component-contract.md`.
