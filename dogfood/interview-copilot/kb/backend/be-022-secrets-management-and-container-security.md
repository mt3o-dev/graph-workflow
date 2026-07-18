---
id: be-022
question: "How do you manage secrets and harden containers in production?"
category: backend
difficulty: medium
expertise: mid
tags: [security, secrets-management, containers]
---

For secrets, the non-negotiable rule is that nothing sensitive — API keys, database passwords, signing keys — goes in source control, container images, or plain environment variables baked into a Dockerfile. I use a dedicated secrets manager like Vault, AWS Secrets Manager, or a cloud provider's equivalent, inject secrets at runtime via environment variables or mounted files, and rotate them on a schedule with automated rotation where the tooling supports it. On container hardening, I build from minimal base images like distroless or alpine to shrink the attack surface, run as a non-root user, set a read-only root filesystem where the app allows it, and drop unnecessary Linux capabilities rather than running privileged containers. I scan images for known CVEs in the CI pipeline, using tools like Trivy or Grype, and fail the build above a severity threshold, and I keep base images patched with automated rebuilds rather than treating an image as build-once. At the orchestration level, I apply network policies to restrict pod-to-pod traffic to what's actually needed, use resource limits to prevent noisy-neighbor issues, and never bake secrets into image layers, since layers are effectively permanent and easy to extract.
