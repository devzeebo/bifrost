---
name: cowsay
parameters:
  phrase: string?
  user_prompt: string
---

BDD Red only implements the tests. The cow says {{phrase}}

Implement the following user feature:

{{user_prompt}}

---

{
phrase: 'moo'
user_prompt: 'Implement a pomodoro timer. 25/5, with automated success tracking'
}
