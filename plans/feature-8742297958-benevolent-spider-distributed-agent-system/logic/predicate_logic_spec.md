# Predicate Logic Specification for Benevolent Spider Distributed Agent System (Refined)

## Domain Objects

### Entities

- `discovery_channel(C)` - C is a discovery channel (DNS, well-known URL, QR)
- `user(U)` - U is a user/potential host
- `node(N)` - N is a compute node
- `consent_token(T)` - T is a cryptographic consent token
- `task(Ta)` - Ta is a computational task
- `sandbox(S)` - S is an OS-specific sandbox container
- `reputation_score(R)` - R is a reputation value (0-100)

### States

- `state_published(U, C)` - user U published signal on channel C
- `state_verified(U, C)` - signal from user U on channel C is verified
- `state_token_issued(T, U)` - consent token T issued to user U
- `state_token_revoked(T)` - consent token T is revoked
- `state_node_sandboxed(N, S)` - node N is running in sandbox S
- `state_node_active(N)` - node N is active and available
- `state_node_byzantine(N)` - node N exhibits Byzantine behavior
- `state_task_assigned(Ta, Nodes)` - task Ta assigned to set of nodes
- `state_consensus_achieved(Ta, Result)` - task Ta achieved consensus on Result

## Refined Predicates

### Opt-In Discovery Rules

```prolog
% Discovery signal publication
signal_published(U, C) :-
    user(U),
    discovery_channel(C),
    user_voluntary_action(U, publish_signal),
    channel_supports_signal(C, U).

% Signal verification with authenticity check
signal_verified(U, C) :-
    signal_published(U, C),
    cryptographic_signature_valid(U, C),
    discovery_channel_authentic(C),
    not previously_verified(U, C).

% Verified invitation creation
invitation_created(U) :-
    exists(C, signal_verified(U, C)),
    user_consent_ready(U).
```

### Consent Token Management Rules

```prolog
% Consent token issuance with scoped permissions
consent_token_issued(T, U, Permissions, Limits, Expiry) :-
    consent_token(T),
    user(U),
    invitation_created(U),
    user_grants_explicit_consent(U, Permissions, Limits),
    token_id_unique(T),
    expiry_time_valid(Expiry),
    cryptographic_signature_valid(T).

% Valid consent token verification
valid_consent_token(T) :-
    consent_token(T),
    not state_token_revoked(T),
    token_expiry_not_passed(T),
    cryptographic_signature_valid(T).

% Consent token revocation
consent_revoked(T, Reason) :-
    consent_token(T),
    (user_initiates_revocation(T, Reason) ;
     automatic_revocation_trigger(T, Reason)),
    state_token_revoked(T).

% Permission validation
action_permitted(N, Action, T) :-
    node(N),
    consent_token(T),
    node_owner_has_token(N, T),
    valid_consent_token(T),
    action_within_token_scope(Action, T).
```

### OS-Specific Sandboxing Rules

```prolog
% Linux cgroups v2 + seccomp + namespaces
linux_sandbox_created(N, S) :-
    node(N),
    sandbox(S),
    node_os_type(N, linux),
    cgroups_v2_supported(N),
    seccomp_filter_configured(S),
    namespaces_isolated(S, [pid, net, mnt, uts, ipc]),
    apparmor_profile_applied(S).

% Windows Job Objects + AppContainer + WDAC
windows_sandbox_created(N, S) :-
    node(N),
    sandbox(S),
    node_os_type(N, windows),
    job_object_created(S),
    appcontainer_configured(S),
    wdac_policy_applied(S),
    capability_restricted(S).

% macOS task_policy + Sandbox + TCC
macos_sandbox_created(N, S) :-
    node(N),
    sandbox(S),
    node_os_type(N, macos),
    task_policy_background(S),
    sandbox_profile_applied(S),
    tcc_permissions_denied(S),
    code_signing_required(S).

% Resource limit enforcement
resource_limit_enforced(N, R, Limit) :-
    node(N),
    resource(R),
    state_node_sandboxed(N, S),
    sandbox_resource_limit(S, R, Limit),
    current_usage(N, R, Usage),
    Usage =< Limit.
```

### Reputation & Byzantine Fault Tolerance Rules

```prolog
% Reputation scoring
node_reputation(N, Score) :-
    node(N),
    reputation_score(Score),
    task_completion_rate(N, CompletionRate),
    result_accuracy_rate(N, AccuracyRate),
    uptime_reliability(N, UptimeRate),
    network_participation(N, ParticipationRate),
    Score is (CompletionRate * 0.4 + AccuracyRate * 0.3 + 
              UptimeRate * 0.2 + ParticipationRate * 0.1) * 100.

% Byzantine behavior detection
byzantine_behavior_detected(N) :-
    node(N),
    (produces_inconsistent_results(N) ;
     violates_security_policies(N) ;
     fails_consensus_repeatedly(N) ;
     exhibits_malicious_patterns(N)).

% Byzantine node exclusion
byzantine_node_excluded(N) :-
    byzantine_behavior_detected(N),
    state_node_byzantine(N),
    reputation_score_zero(N),
    excluded_from_task_assignment(N).

% Reputation threshold for task assignment
task_assignment_eligible(N, TaskType) :-
    node(N),
    task_type(TaskType),
    node_reputation(N, Score),
    minimum_reputation_threshold(TaskType, MinScore),
    Score >= MinScore,
    not state_node_byzantine(N).
```

This refined predicate logic provides the foundation for our enhanced TLA+ specification with comprehensive security, sandboxing, and Byzantine fault tolerance.
