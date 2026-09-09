---
title: "Blog 1 — What Is Spring?"
description: "Why Spring was created, the tight-coupling problems it solves, and how Spring Framework, Spring Core, Spring MVC, and Spring Boot relate to each other."
pubDate: 2026-09-08
---

# Blog 1 — What Is Spring?

🟢 Beginner · Reading: 20 min · Coding: — · Total: ~20 min
Concepts gained: IoC/DI motivation, Spring's core idea, Spring Framework vs Spring Boot vs Spring MVC, module map, ecosystem overview
Concepts unlocked: Blog 2 (IoC and DI Fundamentals), Blog 3 (Beans and the Container)

---

## 1. Prerequisites

No previous Spring knowledge required.

You should be comfortable with:

* Java classes, interfaces, and `new`
* Constructors and method calls
* The general idea of a "layered" application (controller → service → repository)

---

## 2. What You Will Learn

* Why Spring was created — the specific pain points in pre-Spring Java EE development
* What "tight coupling" actually costs you, concretely
* Why Inversion of Control (IoC) and Dependency Injection (DI) became the industry's answer
* The difference between Spring Framework, Spring Core, Spring MVC, and Spring Boot
* A map of the Spring ecosystem and where Spring Core sits in it
* When Spring is the right tool, and when it's overkill
* A mental model you'll reuse for the rest of this series

---

## 3. Why This Topic Matters

Every developer who learns Spring backwards — annotations first, theory never — eventually hits a wall: a bean fails to wire, a proxy behaves strangely, `@Autowired` picks the "wrong" implementation, and there's no mental model to reason from. They can write Spring Boot controllers, but they can't debug a `NoUniqueBeanDefinitionException` or explain why constructor injection is preferred.

This series exists to close that gap. Blog 1 doesn't teach syntax — it teaches *why the syntax needs to exist at all*. Everything from Blog 2 onward (IoC, DI, beans, the container, lifecycle, proxies) is Spring's answer to problems introduced in this post. If you skip this one, the rest of the series will feel like memorizing rules instead of understanding a system.

---

## 4. Real-World Problem

Before Spring existed (and before you use Spring in your own code), here's how you'd naturally write a small e-commerce order flow in plain Java:

```java
package com.example.orders.plain;

public class PaymentService {
    private final PaymentGateway gateway = new StripePaymentGateway(); // hard-coded

    public void charge(double amount) {
        gateway.process(amount);
    }
}
```

```java
package com.example.orders.plain;

public class StripePaymentGateway implements PaymentGateway {
    @Override
    public void process(double amount) {
        System.out.println("Charging $" + amount + " via Stripe");
    }
}
```

```java
package com.example.orders.plain;

public class OrderService {
    private final PaymentService paymentService = new PaymentService(); // hard-coded

    public void placeOrder(double amount) {
        System.out.println("Placing order for $" + amount);
        paymentService.charge(amount);
    }
}
```

```java
package com.example.orders.plain;

public class Main {
    public static void main(String[] args) {
        OrderService orderService = new OrderService();
        orderService.placeOrder(250.0);
    }
}
```

This compiles and runs fine. The pain shows up the moment requirements change, which they always do:

**Problem 1 — Tight coupling.** `OrderService` is permanently welded to `PaymentService`, and `PaymentService` is permanently welded to `StripePaymentGateway`. If the business wants to switch to Razorpay for Indian customers, you're editing `PaymentService`'s source code, not configuring a choice.

**Problem 2 — Object creation is scattered everywhere.** Every class that needs a `PaymentService` calls `new PaymentService()` itself. There is no single place that knows "how the application is wired together." As the app grows to fifty classes, this knowledge is smeared across fifty constructors.

**Problem 3 — Testing is painful.** To unit-test `OrderService` in isolation, you'd want to substitute a fake `PaymentService` that doesn't actually hit a payment gateway. But `OrderService` builds its own `PaymentService` internally — there's no seam to inject a test double. You'd have to use reflection hacks or restructure the class just to test it.

**Problem 4 — Configuration is not externalized.** Which gateway to use, what the API key is, which environment we're in — none of that can vary without a recompile, because it's baked into constructor bodies.

**Problem 5 — Lifecycle and shared state are manual.** If `PaymentService` should be a single shared instance across the whole app (to reuse a connection pool, say), you now have to hand-roll a singleton pattern yourself, correctly, with thread safety, everywhere it's needed.

None of these problems are exotic — every non-trivial Java application built by hand runs into all five. Spring's entire reason for existing is to solve them systematically instead of leaving every team to invent (and often get wrong) their own singleton registries, factory classes, and manual wiring conventions.

---

## 5. Core Concept

**Spring is a framework built around one core idea: your objects should not be responsible for creating or locating their own dependencies. Something external should build the objects, wire them together, and hand each object its collaborators ready-made.**

That "something external" is the Spring **IoC container**. Concretely, Spring lets you describe *what* objects your application needs and *how they depend on each other* — as configuration metadata, written in XML, Java, or annotations — and the container does the actual `new`-ing and wiring for you, in the right order, exactly once (by default).

Rewritten with that idea in mind (informally, before you've seen real Spring syntax):

```text
"I need an OrderService, which needs a PaymentService, which needs a
PaymentGateway. Here's which PaymentGateway implementation to use."
```

You declare the relationships. The container resolves them. `OrderService` no longer contains the line `new PaymentService()` — it simply declares "I require a `PaymentService`" and receives one from outside. This inversion — control over object creation moving from your code to the container — is called **Inversion of Control (IoC)**, and the specific technique of "receiving your dependencies from outside" is called **Dependency Injection (DI)**. Blog 2 covers both in depth; for now, hold onto the idea that *Spring's job is to own object creation and wiring so your classes don't have to.*

**Spring Framework vs Spring Boot vs Spring MVC vs Spring Core** — these four names get conflated constantly, so let's separate them precisely:

* **Spring Core** is the IoC container itself: bean definitions, dependency injection, the `ApplicationContext`, lifecycle management, and the supporting abstractions (resources, events, environment). This is the module this entire series is about.
* **Spring Framework** is the umbrella project. Spring Core is one module inside it, alongside Spring AOP, Spring Data Access (JDBC/ORM), Spring Web, Spring Transaction Management, and more. Every other Spring module is built *on top of* Spring Core's container.
* **Spring MVC** is Spring Framework's web module — a request-handling framework (`@Controller`, `@RequestMapping`, view resolution) that itself lives as beans inside the same IoC container you're learning here.
* **Spring Boot** is not a separate framework — it's an opinionated *packaging and auto-configuration layer* on top of Spring Framework. Boot's job is to guess sensible defaults (embedded Tomcat, auto-configured `DataSource`, starter dependencies) so you write less configuration. Every Spring Boot application is still, underneath, an `ApplicationContext` full of beans wired by the exact mechanisms this series covers. Boot doesn't replace the container — it automates *filling* it.

A useful shorthand: **Spring Core is the engine. Spring MVC, Spring Data, Spring Security, etc. are components built to run on that engine. Spring Boot is the car's onboard computer that configures the engine and components for you so you don't have to turn every knob by hand.** If you understand the engine, you can always look under the hood when Boot's defaults don't fit — which is precisely the skill this series is building.

**Spring ecosystem overview** (non-exhaustive, oriented around where Core sits):

```text
Spring Core (IoC, DI, beans, container)      ← this series
        │
        ├── Spring AOP (cross-cutting concerns, proxies)
        ├── Spring Data Access (JDBC, ORM, transactions)
        ├── Spring Web / Spring MVC (HTTP request handling)
        ├── Spring Security (authentication/authorization)
        ├── Spring Data (repositories over JPA/Mongo/etc.)
        ├── Spring Cloud (distributed systems concerns)
        └── Spring Boot (auto-configuration + packaging over all of the above)
```

Every box below "Spring Core" depends on beans, the container, and the configuration mechanisms you're about to learn. This is why "Spring Core first" is not a stylistic choice — it's a dependency order.

---

## 6. Mental Model

```text
Your Classes (POJOs)
        │  describe dependencies, don't create them
        ▼
Configuration Metadata (XML / Java / Annotations)
        │  tells the container what exists and how it connects
        ▼
Spring IoC Container (ApplicationContext)
        │  creates objects, resolves dependencies, wires them together
        ▼
Fully-Wired Application (a graph of collaborating objects)
```

Read this diagram as: *you write plain classes and describe their relationships; the container is the only thing that ever calls `new` and connects the graph.* Every remaining blog in this series is really just an elaboration of one box in this picture — "Configuration Metadata" gets three blogs of its own (XML/Java/Annotation styles), "Spring IoC Container" gets a dozen blogs on lifecycle, scopes, and internals.

---

## 7. How Spring Works Internally

### Conceptual behavior

At the conceptual level, three things happen whenever a Spring application starts:

1. Spring reads your configuration metadata (XML files, `@Configuration` classes, or annotated classes found via scanning) and builds an internal catalog of "things that can be created" — this catalog entry is called a **bean definition**, not the object itself.
2. Spring creates the actual objects (**beans**) from those definitions, resolving each bean's declared dependencies by creating or reusing other beans as needed.
3. Spring exposes the fully-wired object graph through the **ApplicationContext**, which your application code asks for beans from (ideally only once, at the composition root — see Blog 2).

### Implementation details

*(Flagged explicitly per this series' policy: the following is current, common Spring behavior, not a guaranteed public contract you should code against.)*

In practice, the component that builds bean definitions and instantiates objects is a `BeanFactory` implementation, and `ApplicationContext` is a richer interface that wraps a `BeanFactory` with additional enterprise features (events, message resolution, resource loading — covered in Blog 6). The precise sequence of internal method calls (`prepareRefresh`, `invokeBeanFactoryPostProcessors`, `finishBeanFactoryInitialization`, etc.) is real and traceable in Spring's source, and Blog 33 walks through it in detail — but none of that sequencing is something your application code should ever depend on directly. You interact with the *public contract* (`ApplicationContext`, `@Autowired`, `@Bean`), never the internal refresh machinery.

---

## 8. XML Configuration

This configuration style does not directly apply here because Blog 1 is conceptual — no bean, class, or dependency has been declared yet to configure in XML, Java, or annotations. The three-style comparison begins in earnest in Blog 4, where you'll configure this exact `OrderService` → `PaymentService` → `PaymentGateway` relationship using XML for the first time.

## 9. Java Configuration

This configuration style does not directly apply here for the same reason as above. It is introduced in Blog 4.

## 10. Annotation Configuration

This configuration style does not directly apply here for the same reason as above. It is introduced in Blog 4.

---

## 11. Compare the Three Approaches

Not applicable to this blog — there is no single feature yet to compare across XML, Java, and annotation styles. Blog 4 introduces the first three-way comparison (a `HelloWorld` bean), and every subsequent blog in this series carries the comparison forward for its own topic.

---

## 12. Complete Working Example

Blog 1 is intentionally code-light — its job is motivation, not implementation. The plain-Java example in Section 4 (`OrderService`, `PaymentService`, `StripePaymentGateway`, `Main`) is the only code for this post, and it deliberately contains **no Spring dependency at all** — it exists to demonstrate the problem Spring solves, not to demonstrate Spring itself.

The first real, runnable Spring project — a Maven-based `spring-core-learning` project with a `HelloWorld` bean wired three separate ways — begins in Blog 4. That project becomes the `OrderService`/`PaymentService` example from this post, re-implemented with Spring doing the wiring, and it evolves for the rest of the series.

---

## 13. Execution Flow

For the plain-Java example in Section 4, here is exactly what happens when `main()` runs:

1. The JVM calls `Main.main(String[] args)`.
2. `new OrderService()` executes. Inside `OrderService`'s constructor (implicit default constructor here, but the field initializer runs regardless), `new PaymentService()` executes.
3. Inside `PaymentService`'s field initializer, `new StripePaymentGateway()` executes and is assigned to the `gateway` field.
4. Control returns to `PaymentService`'s construction, which completes and is assigned to `OrderService`'s `paymentService` field.
5. Control returns to `main()`, and `orderService.placeOrder(250.0)` is called.
6. `placeOrder` prints the order line, then calls `paymentService.charge(250.0)`.
7. `charge` calls `gateway.process(250.0)`, which prints the Stripe charge line.

Notice: at no point is there a "wiring phase" separate from execution — object creation and business logic are interleaved and hard-coded together. This is exactly what Spring's container will separate out starting in Blog 3.

---

## 14. Common Mistakes

**Mistake: "Spring is just a bunch of annotations like `@Autowired` and `@Component`."**
Why it happens: most developers meet Spring through Spring Boot tutorials that jump straight to annotated code. Fix: annotations are one of *three* metadata styles for describing the same underlying bean-definition-and-dependency-graph concept — the container behavior is identical regardless of which style produced the metadata.

**Mistake: "Spring Boot is a different, newer framework than Spring."**
Why it happens: the marketing and tooling around Boot feel distinct (starters, auto-configuration, `spring-boot-starter-web`). Fix: Spring Boot applications still run on a plain `ApplicationContext`; Boot only automates what you'd otherwise configure by hand.

**Mistake: "You need Spring for any Java project with more than a few classes."**
Why it happens: Spring is so ubiquitous in backend Java that its use feels default rather than deliberate. Fix: see Section 17 — plenty of legitimate Java projects don't need a DI container at all.

**Mistake: "IoC and DI are the same thing."**
Why it happens: they're almost always mentioned together, and DI is by far the most common implementation of IoC. Fix: Blog 2 draws this line precisely — IoC is the *principle* (something else controls flow/creation), DI is *one technique* implementing it. Service Locator is another (less favored) technique implementing the same principle.

---

## 15. Interview Questions

### Beginner

1. **What problem does Spring solve?**
   It removes the need for application code to manually create and wire its own dependencies, centralizing object creation and configuration in a container.

2. **What is the difference between Spring Framework and Spring Boot?**
   Spring Framework is the core platform (IoC container, AOP, MVC, etc.); Spring Boot is an opinionated auto-configuration and packaging layer built on top of it that reduces manual configuration.

3. **What is tight coupling, and why is it a problem?**
   Tight coupling is when a class directly constructs or hard-codes references to its collaborators. It's a problem because it makes swapping implementations, testing in isolation, and externalizing configuration difficult.

4. **Is Spring MVC part of Spring Boot?**
   No — Spring MVC is a module of Spring Framework itself. Spring Boot auto-configures Spring MVC for web applications, but Spring MVC predates and exists independently of Boot.

5. **What does "Spring Core" refer to specifically?**
   The IoC container and its supporting abstractions — bean definitions, dependency injection, lifecycle management, and infrastructure like resource loading and environment/property handling.

### Intermediate

1. **Why is manual dependency management painful in large codebases?**
   Because the knowledge of "how objects connect" is scattered across every class's constructor instead of centralized, making changes to wiring (e.g., swapping an implementation) require touching many files instead of one configuration point.

2. **How does a DI container improve testability compared to manual `new`-ing?**
   It provides a seam — dependencies are supplied from outside rather than created internally — so tests can substitute mocks or fakes without modifying the class under test.

3. **Why can't you fully solve tight coupling using only interfaces, without a container?**
   Interfaces solve the "depends on abstraction, not concrete class" problem, but something still has to decide *which* implementation to construct and hand over at each call site — without a container, that decision logic is still manually scattered through the code.

4. **What's the practical difference between using Spring Core alone versus Spring Boot?**
   Spring Core alone requires you to explicitly declare and wire every bean; Spring Boot inspects your classpath and environment to auto-configure many beans (data sources, web servers, message converters) with sensible defaults, while still allowing manual override.

5. **Why might a team choose not to adopt Spring for a project?**
   For small, short-lived, or highly specialized applications where the overhead of a DI container and its learning curve outweighs the coordination benefits it provides — see Section 17.

### Advanced

1. **Spring Core, Spring AOP, and Spring MVC are separate modules — why does Spring MVC still depend on Spring Core rather than being fully independent?**
   Because Spring MVC's controllers, view resolvers, and handler mappings are themselves beans managed by the IoC container; MVC relies on the container's dependency injection, lifecycle, and configuration mechanisms rather than reimplementing its own.

2. **What is the architectural relationship between Spring Boot's auto-configuration and the IoC container?**
   Auto-configuration classes are themselves `@Configuration` classes registered conditionally; they contribute `@Bean` definitions to the same `ApplicationContext` your own configuration classes contribute to — Boot doesn't bypass the container, it populates it programmatically based on classpath and property detection.

3. **Why does Spring favor "configuration metadata describing a dependency graph" over a purely programmatic wiring API?**
   Externalized, declarative metadata (XML, `@Configuration`, annotations) can be introspected, validated, overridden, and post-processed by the framework itself (e.g., `BeanFactoryPostProcessor`s) before any object is created — a purely imperative "just call `new` in the right order yourself" approach offers no such hook for framework-level extension.

4. **If Spring Boot can auto-configure almost everything, why does understanding Spring Core still matter for a Boot developer?**
   Because auto-configuration is a set of defaults built from the same primitives (beans, bean definitions, conditional registration) you're learning here; understanding Core lets you diagnose why a bean was or wasn't auto-configured, override defaults correctly, and debug wiring failures that Boot's abstractions don't fully hide.

5. **In what sense is "Spring" more accurately described as a family of related containers/frameworks than a single product?**
   Because "Spring" is used colloquially to refer to Spring Framework (multiple independent modules sharing the IoC container), Spring Boot (a layer on top), and the broader Spring portfolio (Spring Cloud, Spring Data, Spring Security, Spring Batch, etc.) — each independently versioned and independently usable, unified only by their shared dependence on the Spring Core container.

### Internal/Architecture

1. **What is the architectural role of "configuration metadata" in Spring's design?**
   It's the input format the container consumes to build bean definitions; by supporting three interchangeable metadata formats (XML, Java, annotations) that all compile down to the same internal `BeanDefinition` model (covered in Blog 22), Spring decouples *how you describe* your object graph from *how the container processes* it.

2. **Why does Spring separate "bean definition" from "bean instance" as distinct concepts?**
   Because the container needs to reason about the *shape* of the object graph (dependencies, scope, lifecycle metadata) before any object exists — this separation is what allows features like `BeanFactoryPostProcessor` to modify definitions before instantiation ever occurs (Blog 19).

3. **What design principle is Spring's entire approach to object creation an application of?**
   The Dependency Inversion Principle, combined with programming to abstractions — high-level modules (your business logic) should not depend on low-level modules (concrete implementations); both should depend on abstractions, with the container supplying the concrete wiring at runtime.

4. **Why is it significant that Spring Boot's auto-configuration is itself expressed as ordinary `@Configuration` classes rather than special-cased container behavior?**
   It means the exact same extension points (conditional bean registration, `@Import`, bean overriding) available to application developers are what Boot itself uses — there's no hidden privileged mechanism, which is why Boot defaults can always be overridden using standard Spring configuration.

5. **Why does this series teach Spring Core before Spring Boot, given that most production teams start new projects with Boot?**
   Because Boot's value proposition — sensible defaults, less configuration — is only fully legible once you understand what's being defaulted; without Core, "Boot auto-configured a `DataSource`" is a magic trick, but with Core, it's recognizable as "a conditionally-registered `@Bean` method contributing to the same `ApplicationContext` you could configure yourself."

---

## 16. Production Considerations

* **Maintainability:** centralizing wiring in configuration metadata (rather than scattering `new` calls) means changing an implementation is a one-line configuration change, not a multi-file refactor.
* **Testability:** DI-friendly classes accept collaborators through constructors, making it trivial to substitute test doubles without touching production code.
* **Performance:** the container's startup cost (reading metadata, resolving the dependency graph, instantiating singletons) is a one-time cost at application boot, not a per-request cost — this matters for evaluating Spring's overhead in latency-sensitive or short-lived processes (e.g., CLI tools, AWS Lambda cold starts).
* **Lifecycle implications:** singleton beans live for the container's lifetime; this is efficient for stateless services but requires care with any bean holding mutable state, since it will be shared across every caller by default (Blog 14).
* **Concurrency:** Spring itself doesn't make your beans thread-safe — it manages *how many instances exist and when they're created*, not what happens when multiple threads call methods on a shared singleton concurrently. That responsibility remains yours.
* **Architecture:** adopting Spring is, in effect, adopting a specific architectural style — composition-root-based wiring, programming to interfaces, externalized configuration — team members need to understand this style, not just the API surface.

---

## 17. When NOT To Use It

Spring is not a default you should reach for unconditionally. Consider skipping it (or a full DI container generally) when:

* **The application is small and short-lived.** A one-off script, a small CLI utility, or a proof-of-concept with a handful of classes gets little benefit from a container and pays real costs: startup time, added dependencies, and cognitive overhead for anyone reading the code later.
* **You have very few, stable dependencies.** If `OrderService` will only ever have one `PaymentService` implementation, and that's unlikely to change, manual construction is simpler and more transparent than configuring a container to do the same thing.
* **Startup latency is critical and the workload is trivial.** Extremely latency-sensitive, short-lived compute (some serverless/FaaS scenarios) can be hurt by container initialization overhead relative to the actual work performed — lighter-weight alternatives or manual wiring may be more appropriate.
* **The team lacks Spring experience and the project is genuinely simple.** Introducing a DI container's concepts (bean lifecycle, scopes, proxies) purely out of habit, on a project that doesn't need them, adds a real learning-curve tax without a matching benefit.
* **You need extremely fine-grained control over object creation timing/order and find the container's conventions fight you.** This is rare, but some low-level or performance-critical code prefers explicit, hand-written wiring precisely to avoid any framework-managed indirection.

The decision isn't "Spring is good" or "Spring is bad" — it's "does this application have enough moving parts, enough need for testability and configurability, and enough expected growth to justify the container's overhead?" Most backend services above trivial size answer yes; not all Java programs do.

---

## 18. Key Takeaways

* Spring exists to solve five concrete pains of manual object wiring: tight coupling, scattered object creation, poor testability, non-externalized configuration, and manual lifecycle management.
* Spring's core idea is Inversion of Control: your classes describe dependencies; the container creates and wires objects.
* Spring Core (the IoC container) is the foundation every other Spring module — AOP, MVC, Data, Security — is built on top of.
* Spring Framework, Spring Boot, and Spring MVC are related but distinct: Framework is the platform, MVC is a module within it, and Boot is an auto-configuration layer on top of the whole thing — not a separate framework.
* Configuration metadata (XML, Java, annotations) are three interchangeable ways of describing the same underlying bean/dependency-graph model — this equivalence is a theme for the entire series.
* Spring is a deliberate architectural choice, not a universal default — small, simple, or extremely latency-sensitive programs may not benefit from it.

---

## 19. Next Blog

Blog 1 established *why* something like Spring needs to exist. Blog 2 — **IoC and DI Fundamentals** — takes the informal "container creates and wires objects" idea from this post and makes it precise: what Inversion of Control actually inverts, the three concrete DI mechanisms (constructor, setter, field), how a dependency graph and a composition root relate, and how DI compares to alternative patterns like Service Locator and manual factories. Everything from Blog 3 onward assumes you can reason fluently in these terms.

---

### Exercise 1 — Basic
Rewrite the `OrderService`/`PaymentService`/`StripePaymentGateway` example from Section 4 so that `PaymentService` supports **two** gateways (Stripe and Razorpay) selected by a `String` constructor argument passed to `PaymentService`, without using Spring. Notice how much branching logic this requires, and keep this version — you'll compare it against Spring's approach in Blog 12.

### Exercise 2 — Intermediate
Identify, in your own current (or most recent) Java project, three places where a class directly constructs one of its own dependencies with `new`. For each, write one sentence describing what would have to change in the source code if that dependency's implementation needed to be swapped.

### Exercise 3 — Advanced
Without writing any Spring code yet, sketch (in comments or pseudocode) what a minimal "container" class would need to do to automatically wire `OrderService → PaymentService → PaymentGateway` given only class definitions — i.e., what information would it need, and in what order would it have to create objects?

### Exercise 4 — Debugging
A colleague says: "We don't need Spring — we already wrote a `ServiceLocator` class with a static map of `Class -> Object`, and every service calls `ServiceLocator.get(PaymentService.class)` instead of `new`." Identify at least two problems this approach still has that a proper DI approach (Blog 2) avoids.
