---- MODULE BenevolentSpiderSimple ----
(*
 * Simplified TLA+ Specification for syntax validation
 *)

EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    Users,           
    Nodes,           
    Tasks            

VARIABLES
    verifiedInvitations,   \* Set of verified invitations
    consentTokens,         \* [user -> Set of token IDs] 
    nodeState,             \* [node -> State] 
    taskQueue              \* Sequence of pending tasks

vars == <<verifiedInvitations, consentTokens, nodeState, taskQueue>>

TypeInvariant ==
    /\ verifiedInvitations \subseteq (Users \X {"DNS"})
    /\ consentTokens \in [Users -> SUBSET {"token1"}]
    /\ nodeState \in [Nodes -> {"unregistered", "active"}]
    /\ taskQueue \in Seq(Tasks)

Init ==
    /\ verifiedInvitations = {}
    /\ consentTokens = [u \in Users |-> {}]
    /\ nodeState = [n \in Nodes |-> "unregistered"]
    /\ taskQueue = <<>>

VerifyDiscoverySignal(user) ==
    /\ <<user, "DNS">> \notin verifiedInvitations
    /\ verifiedInvitations' = verifiedInvitations \cup {<<user, "DNS">>}
    /\ UNCHANGED <<consentTokens, nodeState, taskQueue>>

IssueConsentToken(user) ==
    /\ \E ch \in {"DNS"} : <<user, ch>> \in verifiedInvitations
    /\ Cardinality(consentTokens[user]) = 0
    /\ consentTokens' = [consentTokens EXCEPT ![user] = {"token1"}]
    /\ UNCHANGED <<verifiedInvitations, nodeState, taskQueue>>

ActivateNode(node) ==
    /\ nodeState[node] = "unregistered"
    /\ consentTokens[CHOOSE u \in Users : TRUE] # {}
    /\ nodeState' = [nodeState EXCEPT ![node] = "active"]
    /\ UNCHANGED <<verifiedInvitations, consentTokens, taskQueue>>

Next ==
    \/ \E user \in Users : VerifyDiscoverySignal(user)
    \/ \E user \in Users : IssueConsentToken(user)
    \/ \E node \in Nodes : ActivateNode(node)

Spec == Init /\ [][Next]_vars

SafetyInvariants == TypeInvariant

====
