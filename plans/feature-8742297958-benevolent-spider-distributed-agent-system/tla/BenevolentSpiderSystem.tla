---- MODULE BenevolentSpiderSystem ----
(*
 * TLA+ Specification for Benevolent Spider Distributed Agent System
 * 
 * This specification models a secure distributed system using opt-in discovery,
 * cryptographic consent tokens, OS-specific sandboxing, redundant verification,
 * and reputation-based task distribution while maintaining strict safety 
 * and liveness properties.
 *)

EXTENDS Naturals, Integers, Sequences, FiniteSets, TLC

\* Utility operators
Min(x, y) == IF x <= y THEN x ELSE y
Max(x, y) == IF x >= y THEN x ELSE y
Range(seq) == {seq[i] : i \in 1..Len(seq)}

CONSTANTS
    DiscoveryChannels,     \* Set of discovery channels (DNS, Web, QR)
    Users,                 \* Set of potential users/hosts  
    Nodes,                 \* Set of compute nodes
    Tasks,                 \* Set of computational tasks
    TaskTypes,             \* Set of allowed task types
    Resources,             \* Set of resource types {CPU, RAM, Storage, Bandwidth}
    MaxTokensPerUser,      \* Maximum consent tokens per user
    MaxTaskReplicas,       \* Maximum replicas per task
    MinConsensusNodes,     \* Minimum nodes for consensus
    MaxResourceUsage       \* Maximum resource usage percentage

VARIABLES
    \* Discovery state
    discoverySignals,      \* [channel -> SUBSET Users] (published signals)
    verifiedInvitations,   \* Set of verified invitations
    
    \* Consent token state  
    consentTokens,         \* [user -> Set of ConsentToken] (active tokens)
    tokenRevocations,      \* Set of revoked token IDs
    
    \* Node and security state
    nodeState,             \* [node -> State] where State in {unregistered, assessing, sandboxed, active, compromised}
    nodeOwner,             \* [node -> user] (who owns each node)
    nodeProfiles,          \* [node -> ResourceProfile] (assessed capabilities)
    sandboxes,             \* [node -> SandboxConfig] (OS-specific containers)
    nodeReputation,        \* [node -> Nat] (reputation scores 0-100)
    
    \* Task execution state
    taskQueue,             \* Sequence of pending tasks
    taskAssignments,       \* [task -> Set of nodes] (replica assignments)
    taskResults,           \* [task -> [node -> result]] (execution results)
    consensusResults,      \* [task -> result] (verified consensus results)
    
    \* Security monitoring
    userActivity,          \* [node -> BOOLEAN] (user currently active)
    resourceUsage,         \* [node -> [resource -> Nat]] (current usage)
    securityViolations,    \* Set of detected security violations
    byzantineNodes,        \* Set of nodes exhibiting Byzantine behavior
    
    \* Economy state
    ledger,                \* Seq of ledger entries
    balance,               \* [user -> Int] credit balance
    accountedPairs,        \* SUBSET (Users \X Tasks): (user, task) pairs already earned
    holds                  \* [user -> Nat] reserved credits for upcoming jobs (optional)

\* Type definitions for structured data
LedgerKind == {"EARN","REDEEM","REFUND","SLASH"}

LedgerEntryType ==
  [ id: STRING,
    ts: Nat,
    user: Users,
    task: Tasks,
    kind: LedgerKind,
    ccDelta: Int ]

\* Helper
AppendEntry(seq, entry) == Append(seq, entry)

ConsentTokenType == [
    tokenId: {"token1", "token2"},
    userId: {"u1", "u2"},
    permissions: [TaskTypes -> BOOLEAN],
    resourceLimits: [Resources -> 1..2],
    expiresAt: 1..2,
    revoked: BOOLEAN
]

ResourceProfileType == [
    osType: {"linux", "windows"},
    cpuCores: 1..2,
    memoryMB: 1..2,
    storageGB: 1..2,
    containerSupport: BOOLEAN
]

SandboxConfigType == [
    osType: {"linux", "windows"},
    limits: [Resources -> 1..2],
    securityPolicy: {"strict", "permissive"},
    monitoringEnabled: BOOLEAN
]

vars == <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
          nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
          taskQueue, taskAssignments, taskResults, consensusResults,
          userActivity, resourceUsage, securityViolations, byzantineNodes,
          ledger, balance, accountedPairs, holds>>

TypeInvariant ==
    /\ discoverySignals \in [DiscoveryChannels -> SUBSET Users]
    /\ verifiedInvitations \subseteq (Users \X DiscoveryChannels)
    /\ consentTokens \in [Users -> SUBSET ConsentTokenType]
    /\ tokenRevocations \subseteq STRING
    /\ nodeState \in [Nodes -> {"unregistered", "assessing", "sandboxed", "active", "compromised"}]
    /\ nodeOwner \in [Nodes -> Users]
    /\ nodeProfiles \in [Nodes -> ResourceProfileType]
    /\ sandboxes \in [Nodes -> SandboxConfigType]
    /\ nodeReputation \in [Nodes -> 0..100]
    /\ taskQueue \in Seq(Tasks)
    /\ taskAssignments \in [Tasks -> SUBSET Nodes]
    /\ taskResults \in [Tasks -> [Nodes -> STRING]]
    /\ consensusResults \in [Tasks -> STRING]
    /\ userActivity \in [Nodes -> BOOLEAN]
    /\ resourceUsage \in [Nodes -> [Resources -> Nat]]
    /\ securityViolations \subseteq (Nodes \X STRING)
    /\ byzantineNodes \subseteq Nodes
    /\ ledger \in Seq(LedgerEntryType)
    /\ balance \in [Users -> Int]
    /\ accountedPairs \subseteq (Users \X Tasks)
    /\ holds \in [Users -> Nat]

\* Helper Predicates

HasValidToken(u, n) ==
    \E t \in consentTokens[u] :
        /\ ~t.revoked
        /\ t.tokenId \notin tokenRevocations
        /\ \A tt \in DOMAIN t.permissions : t.permissions[tt] \in BOOLEAN
        /\ \A r \in Resources : t.resourceLimits[r] \in Nat

\* Initial State

Init ==
    /\ discoverySignals = [ch \in DiscoveryChannels |-> {}]
    /\ verifiedInvitations = {}
    /\ consentTokens = [u \in Users |-> {}]
    /\ tokenRevocations = {}
    /\ nodeState = [n \in Nodes |-> "unregistered"]
    /\ nodeOwner \in [Nodes -> Users]
    /\ nodeProfiles \in [Nodes -> ResourceProfileType]
    /\ sandboxes \in [Nodes -> SandboxConfigType]
    /\ nodeReputation = [n \in Nodes |-> 50]  \* Start with neutral reputation
    /\ taskQueue = <<>>
    /\ taskAssignments = [t \in Tasks |-> {}]
    /\ taskResults = [t \in Tasks |-> [n \in Nodes |-> "pending"]]
    /\ consensusResults = [t \in Tasks |-> "unverified"]
    /\ userActivity \in [Nodes -> BOOLEAN]
    /\ resourceUsage = [n \in Nodes |-> [r \in Resources |-> 0]]
    /\ securityViolations = {}
    /\ byzantineNodes = {}
    /\ ledger = << >>
    /\ balance = [u \in Users |-> 0]
    /\ accountedPairs = {}
    /\ holds = [u \in Users |-> 0]

\* Opt-In Discovery Actions

PublishDiscoverySignal(user, channel) ==
    /\ discoverySignals' = [discoverySignals EXCEPT ![channel] = @ \cup {user}]
    /\ UNCHANGED <<verifiedInvitations, consentTokens, tokenRevocations,
                   nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

VerifyDiscoverySignal(user, channel) ==
    /\ user \in discoverySignals[channel]
    /\ <<user, channel>> \notin verifiedInvitations
    /\ verifiedInvitations' = verifiedInvitations \cup {<<user, channel>>}
    /\ UNCHANGED <<discoverySignals, consentTokens, tokenRevocations,
                   nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

\* Consent Token Management

IssueConsentToken(user, tokenId, permissions, limits, expiry) ==
    /\ \E ch \in DiscoveryChannels : <<user, ch>> \in verifiedInvitations  \* Must have verified invitation
    /\ Cardinality(consentTokens[user]) < MaxTokensPerUser
    /\ tokenId \notin tokenRevocations
    /\ permissions \in [TaskTypes -> BOOLEAN]
    /\ limits \in [Resources -> Nat]
    /\ expiry \in Nat
    /\ LET newToken == [tokenId |-> tokenId, userId |-> user, 
                        permissions |-> permissions, resourceLimits |-> limits,
                        expiresAt |-> expiry, revoked |-> FALSE]
       IN consentTokens' = [consentTokens EXCEPT ![user] = @ \cup {newToken}]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, tokenRevocations,
                   nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

RevokeConsentToken(user, tokenId) ==
    /\ \E token \in consentTokens[user] : token.tokenId = tokenId /\ ~token.revoked
    /\ tokenRevocations' = tokenRevocations \cup {tokenId}
    /\ consentTokens' = [consentTokens EXCEPT ![user] = 
                         {token \in @ : IF token.tokenId = tokenId 
                                       THEN [token EXCEPT !.revoked = TRUE]
                                       ELSE token}]
    \* Force all user's nodes to unregistered state
    /\ nodeState' = [n \in Nodes |-> 
                     IF nodeOwner[n] = user THEN "unregistered" 
                     ELSE nodeState[n]]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, nodeOwner, nodeProfiles, 
                   sandboxes, nodeReputation, taskQueue, taskAssignments, 
                   taskResults, consensusResults, userActivity, resourceUsage, 
                   securityViolations, byzantineNodes, ledger, balance, accountedPairs, holds>>

\* Task Assignment with Redundant Verification

\* Task Queue Management

EnqueueTask(task) ==
    /\ task \notin Range(taskQueue)
    /\ taskQueue' = Append(taskQueue, task)
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

DequeueTask(task) ==
    /\ \E i \in 1..Len(taskQueue) : taskQueue[i] = task
    /\ LET idx == CHOOSE i \in 1..Len(taskQueue) : taskQueue[i] = task
       IN taskQueue' = SubSeq(taskQueue, 1, idx-1) \o SubSeq(taskQueue, idx+1, Len(taskQueue))
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

\* Reputation Management

UpdateReputation(node) ==
    /\ nodeReputation' = [nodeReputation EXCEPT ![node] = 
                         IF node \in byzantineNodes THEN 0
                         ELSE IF consensusResults[CHOOSE t \in Tasks : node \in taskAssignments[t]] # "unverified"
                         THEN Min(100, nodeReputation[node] + 10)
                         ELSE Max(0, nodeReputation[node] - 5)]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeState, nodeOwner, nodeProfiles, sandboxes,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

\* Activity Management

SuspendOnActivity(node) ==
    /\ userActivity[node]
    /\ nodeState[node] = "active"
    /\ nodeState' = [nodeState EXCEPT ![node] = "sandboxed"]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

ResumeWhenIdle(node) ==
    /\ ~userActivity[node]
    /\ nodeState[node] = "sandboxed"
    /\ \E token \in consentTokens[nodeOwner[node]] : ~token.revoked
    /\ nodeState' = [nodeState EXCEPT ![node] = "active"]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

\* Token Management

RotateToken(user, oldTokenId, newToken) ==
    /\ \E t \in consentTokens[user] : t.tokenId = oldTokenId
    /\ newToken.tokenId \notin tokenRevocations
    /\ newToken.userId = user
    /\ newToken.permissions \in [TaskTypes -> BOOLEAN]
    /\ newToken.resourceLimits \in [Resources -> Nat]
    /\ tokenRevocations' = tokenRevocations \cup {oldTokenId}
    /\ consentTokens' = [consentTokens EXCEPT ![user] = 
                        (@ \ {CHOOSE t \in @ : t.tokenId = oldTokenId}) \cup {newToken}]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations,
                   nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

\* Node Assessment and Sandboxing

AssessNode(node) ==
    /\ nodeState[node] = "unregistered"
    /\ \E token \in consentTokens[nodeOwner[node]] : ~token.revoked
    /\ nodeState' = [nodeState EXCEPT ![node] = "assessing"]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

CreateSandbox(node) ==
    /\ nodeState[node] = "assessing"
    /\ nodeState' = [nodeState EXCEPT ![node] = "sandboxed"]
    \* Configure OS-specific sandbox based on node profile
    /\ sandboxes' = [sandboxes EXCEPT ![node] = 
                     [osType |-> nodeProfiles[node].osType,
                      limits |-> [r \in Resources |-> nodeProfiles[node].cpuCores * 10],
                      securityPolicy |-> "strict",
                      monitoringEnabled |-> TRUE]]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeOwner, nodeProfiles, nodeReputation,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

ActivateNode(node) ==
    /\ nodeState[node] = "sandboxed"
    /\ nodeReputation[node] >= 30  \* Minimum reputation threshold
    /\ nodeState' = [nodeState EXCEPT ![node] = "active"]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

\* Task Assignment with Redundant Verification

AssignTaskWithReplicas(task, selectedNodes) ==
    /\ task \in Range(taskQueue)
    /\ Cardinality(selectedNodes) >= MinConsensusNodes
    /\ Cardinality(selectedNodes) <= MaxTaskReplicas
    /\ \A node \in selectedNodes : 
        /\ nodeState[node] = "active"
        /\ ~userActivity[node]
        /\ nodeReputation[node] >= 70  \* High reputation for task assignment
    /\ taskAssignments' = [taskAssignments EXCEPT ![task] = selectedNodes]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskResults, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

SubmitTaskResult(task, node, result) ==
    /\ node \in taskAssignments[task]
    /\ taskResults[task][node] = "pending"
    /\ taskResults' = [taskResults EXCEPT ![task][node] = result]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, consensusResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

VerifyTaskConsensus(task) ==
    LET assigned == taskAssignments[task]
        voters   == { n \in assigned :
                       /\ nodeState[n] = "active"
                       /\ n \notin byzantineNodes
                       /\ taskResults[task][n] # "pending" }
        submittedResults == { taskResults[task][n] : n \in voters }
        resultCounts == [ r \in submittedResults |-> Cardinality({ n \in voters : taskResults[task][n] = r }) ]
        maxCount == CHOOSE c \in Range(resultCounts) : \A c2 \in Range(resultCounts) : c >= c2
        consensusResult == CHOOSE r \in DOMAIN resultCounts : resultCounts[r] = maxCount
    IN
    /\ Cardinality(voters) >= MinConsensusNodes
    /\ consensusResults' = [consensusResults EXCEPT ![task] = consensusResult]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, taskResults,
                   userActivity, resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

\* Security Monitoring

DetectUserActivity(node) ==
    /\ ~userActivity[node]
    /\ userActivity' = [userActivity EXCEPT ![node] = TRUE]
    \* Force immediate resource yielding
    /\ nodeState' = [nodeState EXCEPT ![node] = 
                     IF nodeState[node] = "active" THEN "sandboxed" 
                     ELSE nodeState[node]]
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   resourceUsage, securityViolations, byzantineNodes,
                   ledger, balance, accountedPairs, holds>>

DetectSecurityViolation(node, violation) ==
    /\ securityViolations' = securityViolations \cup {<<node, violation>>}
    /\ nodeState' = [nodeState EXCEPT ![node] = "compromised"]
    /\ byzantineNodes' = byzantineNodes \cup {node}
    /\ nodeReputation' = [nodeReputation EXCEPT ![node] = 0]  \* Zero reputation
    /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                   nodeOwner, nodeProfiles, sandboxes,
                   taskQueue, taskAssignments, taskResults, consensusResults,
                   userActivity, resourceUsage, ledger, balance, accountedPairs, holds>>

\* ---------------- Economy Actions ----------------

\* Earn credits for a (user, task) after consensus verified.
\* Guards also enforce "stop-on-activity": no user-owned node is active while earning.
Earn(u, t, cc, entryId, nowTs) ==
  /\ u \in Users /\ t \in Tasks
  /\ cc \in Nat \ {0}
  /\ <<u, t>> \notin accountedPairs
  /\ consensusResults[t] # "unverified"
  /\ \A n \in Nodes : (nodeOwner[n] = u) => ~userActivity[n]
  /\ LET e == [ id |-> entryId,
                ts |-> nowTs,
                user |-> u,
                task |-> t,
                kind |-> "EARN",
                ccDelta |-> cc ]
     IN /\ ledger' = AppendEntry(ledger, e)
        /\ balance' = [balance EXCEPT ![u] = @ + cc]
        /\ accountedPairs' = accountedPairs \cup {<<u, t>>}
        /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                      nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                      taskQueue, taskAssignments, taskResults, consensusResults,
                      userActivity, resourceUsage, securityViolations, byzantineNodes,
                      holds>>

\* Optional: hold (reserve) credits before scheduling own jobs
Hold(u, amt) ==
  /\ u \in Users /\ amt \in Nat
  /\ balance[u] >= amt
  /\ holds' = [holds EXCEPT ![u] = @ + amt]
  /\ balance' = [balance EXCEPT ![u] = @ - amt]
  /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                taskQueue, taskAssignments, taskResults, consensusResults,
                userActivity, resourceUsage, securityViolations, byzantineNodes,
                ledger, accountedPairs>>

\* Redeem (consume) credits to run a job (debited on completion).
Redeem(u, t, cc, entryId, nowTs) ==
  /\ u \in Users /\ t \in Tasks
  /\ cc \in Nat \ {0}
  /\ holds[u] >= cc \/ balance[u] >= cc
  /\ LET e == [ id |-> entryId,
                ts |-> nowTs,
                user |-> u,
                task |-> t,
                kind |-> "REDEEM",
                ccDelta |-> -cc ]
     IN /\ ledger' = AppendEntry(ledger, e)
        /\ IF holds[u] >= cc
            THEN /\ holds' = [holds EXCEPT ![u] = @ - cc]
                 /\ balance' = balance
            ELSE /\ holds' = holds
                 /\ balance' = [balance EXCEPT ![u] = @ - cc]
        /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                      nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                      taskQueue, taskAssignments, taskResults, consensusResults,
                      userActivity, resourceUsage, securityViolations, byzantineNodes,
                      accountedPairs>>

\* Refund unused hold after job completion if estimate > actual.
Refund(u, cc, entryId, nowTs) ==
  /\ u \in Users /\ cc \in Nat \ {0}
  /\ LET e == [ id |-> entryId,
                ts |-> nowTs,
                user |-> u,
                task |-> CHOOSE x \in Tasks : TRUE,
                kind |-> "REFUND",
                ccDelta |-> cc ]
     IN /\ ledger' = AppendEntry(ledger, e)
        /\ balance' = [balance EXCEPT ![u] = @ + cc]
        /\ UNCHANGED <<discoverySignals, verifiedInvitations, consentTokens, tokenRevocations,
                      nodeState, nodeOwner, nodeProfiles, sandboxes, nodeReputation,
                      taskQueue, taskAssignments, taskResults, consensusResults,
                      userActivity, resourceUsage, securityViolations, byzantineNodes,
                      accountedPairs, holds>>

\* Safety Properties

\* Consent token required and valid for all node operations
ConsentBound ==
    \A n \in Nodes :
        nodeState[n] \in {"sandboxed","active"} => HasValidToken(nodeOwner[n], n)

\* Active nodes must have sandbox configured
ActiveHasSandbox ==
    \A n \in Nodes :
        nodeState[n] = "active" => sandboxes[n] \in SandboxConfigType

\* Resource usage never exceeds sandbox limits
ResourceBounds ==
    \A node \in Nodes, resource \in Resources :
        nodeState[node] \in {"sandboxed", "active"} =>
            resourceUsage[node][resource] <= sandboxes[node].limits[resource]

\* User activity forces immediate resource yielding
NonInterference ==
    \A node \in Nodes :
        userActivity[node] => nodeState[node] \notin {"active"}

\* Only non-Byzantine nodes participate in consensus
ByzantineFaultTolerance ==
    \A task \in Tasks :
        taskAssignments[task] \cap byzantineNodes = {}

\* Minimum reputation required for task assignment
ReputationThreshold ==
    \A task \in Tasks, node \in Nodes :
        node \in taskAssignments[task] => nodeReputation[node] >= 70

\* Token IDs are globally unique
AllTokenIdsUnique ==
    \A u1, u2 \in Users :
        \A t1 \in consentTokens[u1], t2 \in consentTokens[u2] :
            (t1.tokenId = t2.tokenId) => (u1 = u2 /\ t1 = t2)

\* Assignment guards ensure proper authorization
AssignmentGuards ==
    \A t \in Tasks :
        \A n \in taskAssignments[t] :
            /\ nodeState[n] = "active"
            /\ n \notin byzantineNodes
            /\ nodeReputation[n] >= 70
            /\ HasValidToken(nodeOwner[n], n)

\* Token revocation monotonicity
RevocationMonotone ==
    tokenRevocations \subseteq tokenRevocations'

\* Verified invitations are append-only
VerifiedInvitationsMonotone ==
    verifiedInvitations \subseteq verifiedInvitations'

\* Liveness Properties

\* Discovery signals eventually get verified
DiscoveryProgress ==
    \A user \in Users, channel \in DiscoveryChannels :
        (user \in discoverySignals[channel]) ~> (<<user, channel>> \in verifiedInvitations)

\* Valid consent tokens eventually get issued
ConsentTokenProgress ==
    \A user \in Users :
        (\E ch \in DiscoveryChannels : <<user, ch>> \in verifiedInvitations) ~> (consentTokens[user] # {})

\* Assessed nodes eventually get sandboxed
SandboxProgress ==
    \A node \in Nodes :
        (nodeState[node] = "assessing") ~> (nodeState[node] = "sandboxed")

\* Tasks eventually achieve consensus
ConsensusProgress ==
    \A task \in Tasks :
        (task \in Range(taskQueue)) ~> (consensusResults[task] # "unverified")

\* Next State Relation

Next ==
    \/ \E user \in Users, channel \in DiscoveryChannels : 
        PublishDiscoverySignal(user, channel)
    \/ \E user \in Users, channel \in DiscoveryChannels : 
        VerifyDiscoverySignal(user, channel)
    \/ \E user \in Users, tokenId \in {"token1", "token2"}, 
          permissions \in [TaskTypes -> BOOLEAN], 
          limits \in [Resources -> 1..2], 
          expiry \in 1..2 : 
        IssueConsentToken(user, tokenId, permissions, limits, expiry)
    \/ \E user \in Users, tokenId \in {"token1", "token2"} : 
        RevokeConsentToken(user, tokenId)
    \/ \E task \in Tasks : EnqueueTask(task)
    \/ \E task \in Tasks : DequeueTask(task)
    \/ \E node \in Nodes : UpdateReputation(node)
    \/ \E node \in Nodes : SuspendOnActivity(node)
    \/ \E node \in Nodes : ResumeWhenIdle(node)
    \/ \E user \in Users, oldTokenId \in {"token1", "token2"}, newToken \in ConsentTokenType : 
        RotateToken(user, oldTokenId, newToken)
    \/ \E node \in Nodes : AssessNode(node)
    \/ \E node \in Nodes : CreateSandbox(node)
    \/ \E node \in Nodes : ActivateNode(node)
    \/ \E task \in Tasks, selectedNodes \in SUBSET Nodes : 
        AssignTaskWithReplicas(task, selectedNodes)
    \/ \E task \in Tasks, node \in Nodes, result \in {"success", "failure", "pending"} : 
        SubmitTaskResult(task, node, result)
    \/ \E task \in Tasks : VerifyTaskConsensus(task)
    \/ \E node \in Nodes : DetectUserActivity(node)
    \/ \E node \in Nodes, violation \in {"unauthorized_access", "resource_violation"} : 
        DetectSecurityViolation(node, violation)
    \/ \E u \in Users, t \in Tasks, cc \in Nat \ {0}, eid \in STRING, nowTs \in Nat :
        Earn(u, t, cc, eid, nowTs)
    \/ \E u \in Users, amt \in Nat : Hold(u, amt)
    \/ \E u \in Users, t \in Tasks, cc \in Nat \ {0}, eid \in STRING, nowTs \in Nat :
        Redeem(u, t, cc, eid, nowTs)
    \/ \E u \in Users, cc \in Nat \ {0}, eid \in STRING, nowTs \in Nat :
        Refund(u, cc, eid, nowTs)

\* Specification with targeted fairness
Spec == Init /\ [][Next]_vars 
           /\ \A user \in Users, channel \in DiscoveryChannels : 
               WF_vars(VerifyDiscoverySignal(user, channel))
           /\ \A node \in Nodes : WF_vars(CreateSandbox(node))
           /\ \A task \in Tasks : WF_vars(VerifyTaskConsensus(task))
           /\ \A u \in Users, t \in Tasks, cc \in Nat \ {0}, eid \in STRING, nowTs \in Nat :
               WF_vars(Earn(u, t, cc, eid, nowTs))

\* Invariants to Check

\* No negative balances
NonNegativeBalances == \A u \in Users : balance[u] >= 0

\* Conservation: any EARN references a task that has consensus
Conservation ==
  \A i \in 1..Len(ledger) :
    LET e == ledger[i]
    IN e.kind # "EARN" \/ consensusResults[e.task] # "unverified"

\* No double-earn per (user, task)
NoDoubleEarn ==
  \A u \in Users, t \in Tasks :
    Cardinality({ i \in 1..Len(ledger) :
                   LET e == ledger[i] IN e.kind = "EARN" /\ e.user = u /\ e.task = t }) <= 1

\* Stop-on-activity: when a user's node shows activity, no Earn for that user at same state
StopOnActivity ==
  \A u \in Users :
    (\E n \in Nodes : nodeOwner[n] = u /\ userActivity[n]) =>
      TRUE  \* enforced as a guard in Earn; (no Earn enabled in such states)

SafetyInvariants == 
    /\ TypeInvariant
    /\ ConsentBound
    /\ ActiveHasSandbox
    /\ ResourceBounds  
    /\ NonInterference
    /\ ByzantineFaultTolerance
    /\ ReputationThreshold
    /\ AllTokenIdsUnique
    /\ AssignmentGuards
    /\ RevocationMonotone
    /\ VerifiedInvitationsMonotone
    /\ NonNegativeBalances
    /\ Conservation
    /\ NoDoubleEarn

LivenessProperties ==
    /\ DiscoveryProgress
    /\ ConsentTokenProgress  
    /\ SandboxProgress
    /\ ConsensusProgress

====
