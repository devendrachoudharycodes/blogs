---
title: "Understanding Dependency Injection in Spring Boot"
description: "A practical introduction to dependency injection, inversion of control, and how Spring manages application components."
pubDate: 2026-08-24
updatedDate: 2026-08-24
---

Dependency Injection is one of the fundamental concepts behind the Spring Framework.

If you are learning Spring Boot, you will encounter annotations such as `@Component`, `@Service`, `@Repository`, and `@Autowired` very quickly. However, understanding what these annotations actually do is much more important than simply memorizing them.

In this article, we will build the concept from the ground up.

## What Is Dependency Injection?

Suppose we have a service that needs a repository:

```java
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}
```

`UserService` depends on `UserRepository`.

This relationship is called a **dependency**.

The important question is:

> Who creates the `UserRepository` object?

Without a dependency injection framework, we might write:

```java
public class UserService {

    private final UserRepository userRepository;

    public UserService() {
        this.userRepository = new UserRepository();
    }
}
```

This works, but now `UserService` is responsible for creating its own dependency.

That creates tight coupling.

## Inversion of Control

Spring approaches the problem differently.

Instead of allowing `UserService` to create `UserRepository`, Spring creates the required objects and provides them to `UserService`.

This principle is called **Inversion of Control**, commonly abbreviated as IoC.

The control over object creation moves from our application code to the Spring container.

Conceptually:

```text
Without Spring

UserService
    |
    └── creates → UserRepository


With Spring

Spring Container
    |
    ├── creates UserRepository
    |
    └── creates UserService
            |
            └── receives UserRepository
```

The second design gives the application much better separation of responsibilities.

## Constructor Injection

Spring supports several forms of dependency injection, but constructor injection is generally the preferred approach.

Consider this example:

```java
@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow();
    }
}
```

Here, `UserService` declares that it requires a `UserRepository`.

Spring sees the constructor and provides the appropriate bean.

There is no need to manually write:

```java
new UserRepository();
```

inside the service.

## What Is a Spring Bean?

A **Spring bean** is an object managed by the Spring IoC container.

For example:

```java
@Service
public class UserService {
}
```

The `@Service` annotation tells Spring that this class should be registered as a bean.

Similarly:

```java
@Repository
public interface UserRepository {
}
```

and:

```java
@Component
public class EmailValidator {
}
```

can also participate in Spring's component management.

The container is responsible for creating and managing these objects.

## How Does the Dependency Get Resolved?

Consider:

```java
@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}
```

When Spring creates `UserService`, it examines the constructor.

It sees that `UserService` requires:

```text
UserRepository
```

Spring searches its application context for a compatible bean.

If it finds one, it injects that bean into the constructor.

The process can be simplified as:

```text
Application starts
       ↓
Spring scans components
       ↓
Spring creates beans
       ↓
Spring discovers UserService
       ↓
UserService requires UserRepository
       ↓
Spring finds UserRepository bean
       ↓
Spring calls UserService constructor
       ↓
UserService is ready
```

## Why Use Constructor Injection?

Constructor injection has several advantages.

### 1. Dependencies Are Explicit

A class immediately communicates what it needs:

```java
public UserService(UserRepository userRepository)
```

Someone reading the class does not have to search through fields to understand its dependencies.

### 2. Dependencies Can Be Final

We can write:

```java
private final UserRepository userRepository;
```

This makes the dependency immutable after construction.

### 3. Easier Testing

We can create the service manually in a unit test:

```java
UserRepository repository = mock(UserRepository.class);

UserService service = new UserService(repository);
```

The test does not need to start the entire Spring application.

### 4. Prevents Partially Initialized Objects

A constructor can enforce that required dependencies are available when the object is created.

## Constructor Injection vs Field Injection

You may encounter code like this:

```java
@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;
}
```

This is called **field injection**.

Although Spring supports it, constructor injection is generally a better design for required dependencies.

| Approach | Dependencies Explicit | Easy to Unit Test | Recommended |
|---|---|---|---|
| Constructor injection | Yes | Yes | Yes |
| Field injection | No | Less convenient | Usually no |
| Setter injection | Partially | Yes | For optional dependencies |

For most application services, constructor injection should be your default choice.

## Dependency Injection Is About Design

It is easy to think of dependency injection as simply:

```java
@Autowired
```

But that misses the important idea.

Dependency Injection is fundamentally about **decoupling object creation from object usage**.

The service should focus on its business responsibility.

The repository should focus on data access.

The Spring container should manage how those objects are connected.

This separation makes applications easier to maintain, test, and evolve.

## A Simple Mental Model

When learning Spring Boot, remember this:

```text
Your classes define what they need.

        ↓

Spring creates the objects.

        ↓

Spring connects the objects.

        ↓

Your application uses the connected objects.
```

You don't need to manually create every dependency.

Instead, you describe the dependencies your classes require, and Spring manages the object graph.

## A More Realistic Spring Boot Example

Let's look at a small application structure:

```text
Controller
    |
    ↓
UserService
    |
    ↓
UserRepository
    |
    ↓
Database
```

The controller handles HTTP requests.

The service contains business logic.

The repository handles persistence.

For example:

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findUser(id);
    }
}
```

The service:

```java
@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow();
    }
}
```

And the repository:

```java
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
}
```

Spring connects these components automatically.

The resulting dependency graph looks like:

```text
┌────────────────────┐
│   UserController   │
└─────────┬──────────┘
          │
          │ depends on
          ↓
┌────────────────────┐
│    UserService     │
└─────────┬──────────┘
          │
          │ depends on
          ↓
┌────────────────────┐
│   UserRepository   │
└─────────┬──────────┘
          │
          ↓
       Database
```

This is one of the patterns you will use repeatedly when building Spring Boot applications.

## What Happens When Spring Starts?

At application startup, Spring creates an **ApplicationContext**.

The application context acts as the container that manages your application's beans.

A simplified startup process looks like this:

```text
Spring Boot starts
        ↓
ApplicationContext created
        ↓
Component scanning
        ↓
Bean definitions discovered
        ↓
Beans instantiated
        ↓
Dependencies resolved
        ↓
Dependencies injected
        ↓
Application ready
```

This is why Spring Boot applications can have many components without you manually creating every object.

## What If Spring Cannot Find a Dependency?

Suppose we write:

```java
@Service
public class UserService {

    public UserService(PaymentService paymentService) {
    }
}
```

but there is no `PaymentService` bean.

Spring cannot satisfy the constructor dependency.

The application will fail during startup with a bean creation/dependency resolution error.

This is actually useful because the problem is detected early rather than allowing the application to run with an invalid object graph.

## Multiple Implementations

Dependency injection becomes particularly useful when an interface has multiple implementations.

For example:

```java
public interface NotificationService {

    void send(String message);
}
```

We could have:

```java
@Service
public class EmailNotificationService
        implements NotificationService {

    @Override
    public void send(String message) {
        // Send email
    }
}
```

and:

```java
@Service
public class SmsNotificationService
        implements NotificationService {

    @Override
    public void send(String message) {
        // Send SMS
    }
}
```

Now Spring needs additional information to determine which implementation should be injected.

This is where mechanisms such as `@Qualifier` or `@Primary` become important.

For example:

```java
@Service
public class NotificationManager {

    private final NotificationService notificationService;

    public NotificationManager(
            @Qualifier("emailNotificationService")
            NotificationService notificationService) {

        this.notificationService = notificationService;
    }
}
```

The important lesson is that dependency injection is not limited to concrete classes.

It becomes especially powerful when designing components against interfaces.

## Dependency Injection and Loose Coupling

Consider two approaches.

### Tightly Coupled

```java
public class UserService {

    private final MySqlUserRepository repository;

    public UserService() {
        this.repository = new MySqlUserRepository();
    }
}
```

`UserService` knows exactly which repository implementation it must use.

### Loosely Coupled

```java
public class UserService {

    private final UserRepository repository;

    public UserService(UserRepository repository) {
        this.repository = repository;
    }
}
```

Now `UserService` depends on an abstraction.

The implementation can be changed without changing the service itself.

That is one of the major architectural benefits of Dependency Injection.

## Common Mistakes When Learning Dependency Injection

### Mistake 1: Memorizing Annotations

Learning:

```text
@Component
@Service
@Repository
@Autowired
```

without understanding IoC and dependency management will make Spring feel like a collection of magic annotations.

Understand the container first.

### Mistake 2: Using Field Injection Everywhere

Field injection is convenient:

```java
@Autowired
private UserRepository repository;
```

but it hides required dependencies.

Prefer constructor injection for mandatory dependencies.

### Mistake 3: Creating Spring Beans Manually

If Spring manages a component, avoid manually creating another instance with:

```java
new UserService(...)
```

inside application code unless you have a specific reason to do so.

Otherwise, you can end up with objects outside Spring's management.

### Mistake 4: Putting Business Logic Everywhere

Dependency Injection does not automatically create good architecture.

You still need clear responsibilities.

A common structure is:

```text
Controller
    ↓
Service
    ↓
Repository
```

Each layer should have a focused responsibility.

## Dependency Injection in One Sentence

If you remember only one thing from this article, remember this:

> **Dependency Injection means that a class receives the objects it depends on instead of creating those objects itself.**

Spring's IoC container manages those objects and connects them according to your application's dependency graph.

## Conclusion

Dependency Injection is much more than the `@Autowired` annotation.

The important concepts are:

1. A dependency is an object another object requires.
2. IoC transfers control of object creation to the Spring container.
3. Spring beans are objects managed by the container.
4. Constructor injection makes dependencies explicit.
5. Dependency Injection reduces coupling between components.
6. Constructor injection makes code easier to test.
7. Interfaces and dependency injection allow implementations to be changed more easily.
8. The `ApplicationContext` manages the application's beans and their relationships.

Once these concepts are clear, annotations such as `@Component`, `@Service`, and `@Repository` become much easier to understand.

The goal should not be to memorize Spring annotations.

The goal is to understand **why Spring needs them and what problem they solve**.

---

**Next:** In a future article, we can go deeper into the Spring `ApplicationContext`, bean lifecycle, component scanning, and exactly what happens between application startup and dependency injection.
