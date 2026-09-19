---
title: "What Is Spring? The Problem, the Container, and the Mental Model"
description: "Part 1 of the Spring Core series. Why tightly coupled Java code and J2EE-era development led to Spring, what Inversion of Control and Dependency Injection actually change, how Spring Framework, Spring Boot and Spring MVC differ, and the mental model of the container you will master over the next 48 posts."

pubDate: 2026-09-19
updatedDate: 2026-09-19

heroImage: "/images/blog/spring-core/01-what-is-spring.svg"
heroImageAlt: "Configuration metadata (XML, @Configuration, @Component) flows into an IoC container, which produces wired OrderService, PaymentService and PaymentGateway beans."

category: "Spring Core"

tags:
  - spring
  - spring-framework
  - spring-core
  - ioc
  - dependency-injection
  - java
  - beginner

series: "Spring Core Architecture"
seriesPart: 1
seriesTotal: 49

difficulty: "Beginner"

readingTime: 30
codingTime: 15
totalTime: 45

springFrameworkVersion: "7.0.8"
javaVersion: "17+"

prerequisites: []

draft: false
---

Attribute
Details
Series
Spring Core Architecture, Part 1 of 49
Difficulty
🟢 Beginner
Reading / Coding / Total
30 min / 15 min / ~45 min
Tested with
Spring Framework 7.0.8, Java 17+, Maven
Concepts gained
Why Spring exists, coupling and its costs, IoC and DI at a high level, Framework vs Boot vs MVC, modules and ecosystem, the container mental model
Concepts unlocked
Blog 2 (IoC and DI in depth), Blog 3 (beans and the container), and the shared vocabulary for every later post


1. Prerequisites
Java concepts required
Classes, interfaces, constructors, new, and composition (one object holding a reference to another)
Packages and imports
Running a main method
Basic Maven usage (mvn compile), no plugin knowledge needed
Spring concepts required
No previous Spring knowledge required.
Previous blogs required
None. This is the entry point of the series.
Tooling
JDK 17 or newer. Spring Framework 7.0 keeps a Java 17 baseline and supports newer JDKs, up to Java 25.
Maven 3.9 or newer.

2. What You Will Learn
What Spring is, and what it is not
The concrete problems of tightly coupled code: object creation, dependency management, configuration and testing
What J2EE-era development looked like and why Spring was created as an alternative
Why Inversion of Control (IoC) and Dependency Injection (DI) became important
What manual dependency injection solves, and where it stops scaling
Spring Framework vs Spring Boot vs Spring MVC vs "Spring Core"
The major Spring modules and the wider ecosystem
Where the Spring Core container sits in the picture
When Spring is the right tool, and when it is unnecessary
A mental model of the container, and the roadmap of this entire series

3. Why This Topic Matters
Most developers meet Spring backwards. They start with Spring Boot, paste @SpringBootApplication, sprinkle @Autowired, and everything works, until it doesn't. Then a NoSuchBeanDefinitionException or a BeanCurrentlyInCreationException appears, and the annotations offer no explanation.
Everything in Spring, from @Transactional to Spring Security, sits on one idea: a container that builds your objects, wires them together, and can wrap or extend them. If you understand the problem that container solves, you can predict its behavior. If you don't, you memorize annotations and hope.
This blog is deliberately about the problem first. The code is small on purpose, because the goal is to make the need for a container feel obvious before we use one.

4. Real-World Problem
We will use one business scenario for the whole series: placing an order and paying for it. In later blogs this grows into the spring-core-learning project with notifications, repositories and events. For now it is three classes:
OrderService
     ↓
PaymentService
     ↓
PaymentGateway (Stripe)
4.1 What happens without Spring (or any container)
Here is how this is often written first. Every class creates its own collaborators with new.
File: src/main/java/com/example/springcore/blog01/plain/TightlyCoupledApp.java
package com.example.springcore.blog01.plain;

import java.math.BigDecimal;

public class TightlyCoupledApp {

    static class StripePaymentGateway {
        void charge(String orderId, BigDecimal amount) {
            System.out.println("[Stripe] Charging " + amount + " for order " + orderId);
        }
    }

    static class PaymentService {
        // Hard-wired: PaymentService decides WHICH gateway and HOW to build it.
        private final StripePaymentGateway gateway = new StripePaymentGateway();

        void pay(String orderId, BigDecimal amount) {
            if (amount.signum() <= 0) {
                throw new IllegalArgumentException("Amount must be positive: " + amount);
            }
            gateway.charge(orderId, amount);
            System.out.println("[PaymentService] Payment accepted for " + orderId);
        }
    }

    static class OrderService {
        // Hard-wired: OrderService decides HOW to build PaymentService.
        private final PaymentService paymentService = new PaymentService();

        void placeOrder(String orderId, BigDecimal amount) {
            System.out.println("[OrderService] Placing order " + orderId);
            paymentService.pay(orderId, amount);
            System.out.println("[OrderService] Order " + orderId + " confirmed");
        }
    }

    public static void main(String[] args) {
        System.out.println("=== Blog 01 - Tightly coupled (no DI) ===");
        new OrderService().placeOrder("ORD-1001", new BigDecimal("49.99"));
    }
}
Expected output:
=== Blog 01 - Tightly coupled (no DI) ===
[OrderService] Placing order ORD-1001
[Stripe] Charging 49.99 for order ORD-1001
[PaymentService] Payment accepted for ORD-1001
[OrderService] Order ORD-1001 confirmed
It works, and for a 50-line program that is fine. The trouble shows up as the system grows. Look at what this design cost us:
Problem
Where it shows up in the code above
Tight coupling
PaymentService names the concrete class StripePaymentGateway. Moving to Razorpay means editing PaymentService.
Object creation is scattered
new appears inside business classes. There is no single place that says "these are the objects in my application and how they are built".
Hidden dependencies
new OrderService() gives no hint that it needs a payment service, and transitively a Stripe gateway. The dependency graph is buried inside field initializers.
Dependency management
Every OrderService creates its own PaymentService, which creates its own gateway. If the gateway wraps an expensive resource (an HTTP client, a connection pool), you now build many of them.
Configuration problems
Where would the Stripe API key, the timeout, or the dev/prod switch go? Into System.getProperty calls scattered through constructors.
Testing problems
You cannot unit test OrderService without a real PaymentService calling a real StripePaymentGateway. There is no seam to substitute a fake.

4.2 The J2EE-era version of the same problem
Spring was not created because new is bad. It was created because the official enterprise Java approach of the early 2000s made these problems worse, not better.
Legacy / historical context: This describes J2EE / EJB 2.x development circa 2000 to 2004. It explains why Spring was created. It does not describe modern Jakarta EE, which evolved significantly after that (EJB 3.0, CDI and later).
In that model:
Components were invasive: A business object implemented container interfaces (for example javax.ejb.SessionBean), plus home and remote interfaces, plus XML deployment descriptors. Your business logic was welded to the platform.
Collaborators were found by lookup, not handed to you: Code pulled dependencies out of a naming service (JNDI) by string name, following the Service Locator pattern:
// Legacy / historical, illustrative only. Requires the EJB 2.x API; NOT part of our project.
Context ctx = new InitialContext();
Object ref = ctx.lookup("java:comp/env/ejb/PaymentService");
PaymentServiceHome home =
        (PaymentServiceHome) PortableRemoteObject.narrow(ref, PaymentServiceHome.class);
PaymentService paymentService = home.create();
Testing needed a container: Because components depended on the application server, tests often ran inside a deployed server (in-container testing), which was slow and awkward.
Configuration was verbose: Deployment descriptors in XML for every single component.
The ideas that became Spring were published in Rod Johnson's 2002 book Expert One-on-One J2EE Design and Development, and Spring Framework 1.0 followed in 2004. Its pitch was: write plain Java objects (POJOs), describe how they connect, and let a lightweight container do the assembly, with no application server required to run or test them.
4.3 First fix: manual dependency injection
Before introducing any framework, let's fix the design itself. Two changes: depend on an interface instead of a concrete class, and receive collaborators through the constructor instead of creating them.
These domain classes stay unchanged through most of this blog and are reused by the XML and Java Configuration examples later. They contain no Spring imports at all.
File: src/main/java/com/example/springcore/blog01/domain/PaymentGateway.java
package com.example.springcore.blog01.domain;

import java.math.BigDecimal;

public interface PaymentGateway {

    void charge(String orderId, BigDecimal amount);
}
File: src/main/java/com/example/springcore/blog01/domain/StripePaymentGateway.java
package com.example.springcore.blog01.domain;

import java.math.BigDecimal;

public class StripePaymentGateway implements PaymentGateway {

    @Override
    public void charge(String orderId, BigDecimal amount) {
        System.out.println("[Stripe] Charging " + amount + " for order " + orderId);
    }
}
File: src/main/java/com/example/springcore/blog01/domain/PaymentService.java
package com.example.springcore.blog01.domain;

import java.math.BigDecimal;

public class PaymentService {

    private final PaymentGateway paymentGateway;

    public PaymentService(PaymentGateway paymentGateway) {
        this.paymentGateway = paymentGateway;
    }

    public void pay(String orderId, BigDecimal amount) {
        if (amount.signum() <= 0) {
            throw new IllegalArgumentException("Amount must be positive: " + amount);
        }
        paymentGateway.charge(orderId, amount);
        System.out.println("[PaymentService] Payment accepted for " + orderId);
    }
}
File: src/main/java/com/example/springcore/blog01/domain/OrderService.java
package com.example.springcore.blog01.domain;

import java.math.BigDecimal;

public class OrderService {

    private final PaymentService paymentService;

    public OrderService(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    public void placeOrder(String orderId, BigDecimal amount) {
        System.out.println("[OrderService] Placing order " + orderId);
        paymentService.pay(orderId, amount);
        System.out.println("[OrderService] Order " + orderId + " confirmed");
    }
}
Now main becomes the single place that knows how the object graph is assembled. This is called the composition root.
File: src/main/java/com/example/springcore/blog01/plain/ManualWiringApp.java
package com.example.springcore.blog01.plain;

import com.example.springcore.blog01.domain.OrderService;
import com.example.springcore.blog01.domain.PaymentGateway;
import com.example.springcore.blog01.domain.PaymentService;
import com.example.springcore.blog01.domain.StripePaymentGateway;

import java.math.BigDecimal;

public class ManualWiringApp {

    public static void main(String[] args) {
        System.out.println("=== Blog 01 - Manual dependency injection (no container) ===");

        // Composition root: the ONE place that knows the concrete classes and their order.
        PaymentGateway paymentGateway = new StripePaymentGateway();
        PaymentService paymentService = new PaymentService(paymentGateway);
        OrderService orderService = new OrderService(paymentService);

        orderService.placeOrder("ORD-1001", new BigDecimal("49.99"));

        // Same OrderService logic, different collaborator. No source change in the domain classes.
        PaymentGateway fakeGateway = (orderId, amount) ->
                System.out.println("[FakeGateway] Pretending to charge " + amount + " for " + orderId);
        new OrderService(new PaymentService(fakeGateway)).placeOrder("ORD-1002", new BigDecimal("10.00"));
    }
}
PaymentGateway has a single abstract method, so a lambda can implement it. That is exactly what a unit test would do.
Expected output:
=== Blog 01 - Manual dependency injection (no container) ===
[OrderService] Placing order ORD-1001
[Stripe] Charging 49.99 for order ORD-1001
[PaymentService] Payment accepted for ORD-1001
[OrderService] Order ORD-1001 confirmed
[OrderService] Placing order ORD-1002
[FakeGateway] Pretending to charge 10.00 for ORD-1002
[PaymentService] Payment accepted for ORD-1002
[OrderService] Order ORD-1002 confirmed
What changed compared with the tightly coupled version:
The constructor is now honest: new OrderService(paymentService) says exactly what OrderService needs.
PaymentService depends on the abstraction PaymentGateway, so Stripe, Razorpay or a test fake are interchangeable.
Object creation moved to one place (main).
Testing works: we swapped the gateway without touching PaymentService or OrderService.
This is Dependency Injection, and you did it with no framework. That is an important point: DI is a design technique, not a Spring feature.
4.4 What manual DI still leaves unsolved
The composition root above has three lines of wiring. Now imagine 200 classes:
Wiring code explodes: You hand-order 200 constructors, and every new dependency edits the composition root.
Creation order is your problem: You compute the dependency order yourself.
Sharing is your problem: Should there be one PaymentService for the whole application, or one per request? You decide by hand for every object.
Lifecycle is your problem: Initialization after construction and cleanup on shutdown (closing pools, stopping schedulers) must be coded and ordered manually.
Environment-specific configuration is your problem: Which gateway in dev, which in prod, which properties?
Cross-cutting behavior is your problem: Transactions, security checks, caching and metrics need objects to be wrapped by other objects. Doing that by hand for every service means writing decorators everywhere.
Something has to take over this work. A component that reads a description of your objects and their relationships, builds them in the right order, injects dependencies, manages their lifecycle, and can wrap them with extra behavior—that is an IoC container. Spring is, first and foremost, that container.

5. Core Concept
5.1 What is Spring?
Spring Framework is a Java application framework whose foundation is an Inversion of Control (IoC) container. On top of that container sit modules for aspect-oriented programming, transaction management, data access, web applications, messaging and testing.
Its programming model has three parts:
Plain Java objects: Your PaymentService does not extend a Spring class or implement a Spring interface. Spring is non-invasive: domain code stays framework-agnostic wherever possible.
Configuration metadata: You describe which objects exist and how they relate (in XML, Java, annotations, or a mix).
Container services: The container builds, wires, manages and can decorate those objects.
5.2 IoC and DI in one paragraph
Inversion of Control is the principle: your code stops controlling how its collaborators are created and found; something else does. Dependency Injection is the most common technique to achieve it: collaborators are pushed into an object (constructor, setter or field) instead of pulled or created by it. IoC is the broader principle, DI is one mechanism. Blog 2 takes this apart properly, including how DI differs from the Service Locator and Factory patterns.
5.3 How Spring evolved
The container has stayed conceptually the same for two decades. What changed is how you describe your objects. That is why this series teaches every concept in three configuration styles.
Year
Version
What changed (relevant to this series)
2002
n/a
Expert One-on-One J2EE Design and Development publishes the ideas and code that become Spring
2004
1.0
IoC container with XML bean definitions, AOP, JDBC and transaction abstractions
2006
2.0
XML namespaces and custom schemas, more bean scopes
2007
2.5
Annotation-driven configuration: @Autowired, @Component, component scanning
2009
3.0
Java-based configuration: @Configuration, @Bean; SpEL
2011
3.1
Environment abstraction and profiles
2013
4.0
Java 8 support, @Conditional, generics as qualifiers
2014
Boot 1.0
Spring Boot arrives: auto-configuration and starters
2017
5.0
Reactive stack (WebFlux), Kotlin support
2022
6.0
Jakarta EE namespace (jakarta.*), Java 17 baseline, ahead-of-time groundwork
2025
7.0
Jakarta EE 11 baseline, Java 17 baseline with Java 25 supported, JSpecify null-safety, API versioning, resilience annotations

XML, Java and annotation configuration all still work in Spring Framework 7.0. Most new code uses Java and annotations. XML remains relevant mainly for reading existing projects.
5.4 Spring Framework vs Spring Boot vs Spring MVC vs "Spring Core"
These four names cause more confusion than any other Spring topic. They are not alternatives to each other.
Term
What it is
Relationship
Spring Framework
The foundation: IoC container plus modules (AOP, transactions, data access, web, messaging, test). Artifacts are spring-context, spring-webmvc, and so on.
Everything else builds on it.
Spring Core
In this series: the IoC container and its supporting infrastructure (bean definitions, ApplicationContext, lifecycle, scopes, post-processors, Environment, resources, events). Also, literally, an artifact named spring-core: the lowest-level module with utilities and resource/metadata support.
The layer this series studies.
Spring MVC
The Servlet-based web framework module (spring-webmvc): controllers, request mapping, view resolution.
A module inside Spring Framework.
Spring Boot
An opinionated setup layer: auto-configuration, starters (curated dependency sets), an embedded web server, externalized configuration, production endpoints.
Sits on top of Spring Framework. Boot 4.0 is built on Framework 7.0.

The most important distinction: Spring Boot does not replace the container. It creates and configures one for you. A Boot application is a Spring Framework application with a lot of @Configuration written by someone else, applied conditionally. This series intentionally avoids Boot so you see the container without the automation.
5.5 Major Spring Framework modules
Group
Main artifacts
Purpose
Core Container
spring-core, spring-beans, spring-context, spring-context-support, spring-expression
IoC container, ApplicationContext, resources, events, SpEL. (This series)
AOP
spring-aop, spring-aspects
Proxy-based aspect-oriented programming, the machinery behind declarative services
Data access and integration
spring-jdbc, spring-tx, spring-orm, spring-r2dbc, spring-jms
JDBC templates, transaction management, ORM integration, messaging
Web
spring-web, spring-webmvc, spring-webflux, spring-websocket
Servlet-based and reactive web stacks
Messaging
spring-messaging
Message abstractions used by STOMP, WebSocket and more
Test
spring-test
Test context framework and mocks

5.6 The wider Spring ecosystem
Each of these is a separate project that assumes the container underneath.
Project
What it adds
Spring Boot
Auto-configuration, starters, embedded servers, Actuator
Spring Data
Repository abstraction over JPA, MongoDB, Redis and more
Spring Security
Authentication and authorization, applied through filters and method proxies
Spring Cloud
Patterns for distributed systems: config, discovery, gateways
Spring Batch
Large-scale batch processing
Spring Integration
Enterprise integration patterns
Spring for Apache Kafka / AMQP
Messaging client integration
Spring Session
Externalized session management
Spring AI
Integration with AI models and vector stores

5.7 Where Spring Core fits
┌───────────────────────────────────────────────────────────────┐
│  Spring Boot · Spring Data · Spring Security · Spring Cloud   │  ← ecosystem
├───────────────────────────────────────────────────────────────┤
│  Spring MVC / WebFlux │ Transactions │ Data Access │ Messaging│  ← framework modules
├───────────────────────────────────────────────────────────────┤
│                  Spring AOP (proxies)                         │
├───────────────────────────────────────────────────────────────┤
│  ████████████  SPRING CORE CONTAINER (this series)  ████████  │
│  BeanFactory · ApplicationContext · BeanDefinitions ·         │
│  Lifecycle · Scopes · Post-processors · Environment · Events  │
└───────────────────────────────────────────────────────────────┘
Every layer above the container is just more beans configured, wired and wrapped by that container. When you understand the bottom layer, the top layers stop looking like separate magic.
5.8 When Spring should be used
Long-lived applications with many collaborating components: A backend service with dozens or hundreds of classes, where wiring, configuration and lifecycle are real costs.
You need cross-cutting infrastructure: Transactions, security, caching, retries, metrics. These are applied by wrapping beans, which is the container's job.
Environment-dependent behavior: Profiles, externalized properties, swapping implementations per deployment.
You want the ecosystem: Spring Data, Spring Security and Boot all assume the container.
Team scale: A shared, documented convention for how objects are created and connected matters more as the team grows.
(The counterpart, when Spring may be unnecessary, is in Section 17).

6. Mental Model
Think of Spring as a factory manager with a blueprint. You do not build the machine. You hand over a description ("a PaymentGateway, a PaymentService that needs a gateway, an OrderService that needs a payment service"). The manager builds the parts in the right order, plugs them together, hands you the assembled machine, and later shuts it down cleanly.
Without a container: every object builds its own collaborators.
main() ──new──► OrderService ──new──► PaymentService ──new──► StripePaymentGateway
        (each class knows the concrete class of the next one down)
With manual DI: one place builds everything, top-down.
main() ──► new StripePaymentGateway()
       ──► new PaymentService(gateway)
       ──► new OrderService(paymentService)
With the Spring container: you describe, Spring builds.
 Application code
        │  asks for "orderService"
        ▼
 ApplicationContext ─────────────────────────────┐
        │  is (or delegates to) a                │ also provides: events, resources,
        ▼                                        │ environment, message resolution
 BeanFactory                                     ┘
        │  holds
        ▼
 Bean Definitions   (the blueprint, loaded from XML, @Configuration classes, @Component scanning)
        │  resolved into
        ▼
 Dependency Graph   orderService → paymentService → paymentGateway
        │  instantiated and wired into
        ▼
 Bean Instances     (managed, shared, lifecycle-aware objects)
One sentence to keep: Spring turns "how objects are created and connected" from code you write into metadata you declare.
The design principle behind it is sometimes called the Hollywood principle: don't call us, we'll call you. Your classes don't go looking for their collaborators. The container calls the constructor and provides them.

7. How Spring Works Internally
This section is intentionally high-level. Later blogs open each step in detail (Blog 3 for the flow, Blog 26 for BeanDefinition, Blog 45 for the refresh process).
7.1 Conceptual behavior
When an ApplicationContext starts, the following happens conceptually:
Load configuration metadata: An XML file, an @Configuration class, or classes found by component scanning.
Turn metadata into bean definitions: A bean definition is a recipe: which class, which constructor arguments or factory method, which scope, which init and destroy callbacks. Recipes are registered under bean names. No application objects exist yet.
Let the container adjust the recipes: Special extension beans (BeanFactoryPostProcessor) may edit definitions before any object is built, for example to resolve ${...} placeholders.
Instantiate singleton beans in dependency order: For each recipe, the container picks a constructor or factory method, resolves what it needs (recursively creating those first), injects it, runs lifecycle callbacks, and lets BeanPostProcessors inspect or wrap the result. By default, singleton beans are created eagerly at startup.
Publish the context: Your code obtains beans by injection or by getBean(...). The context announces that it is ready by publishing an event.
On close, destroy beans: Destruction callbacks run, in reverse dependency order.
 Metadata ─► BeanDefinitions ─► (BeanFactoryPostProcessors edit) ─► create beans
                                                                        │
                                       constructor ─► inject ─► callbacks ─► BeanPostProcessors
                                                                        │
                                                                  ready to use ─► close ─► destroy
Notice the ordering rule that unlocks half of Spring's design: definitions come before instances. Because the container knows the whole graph as data before creating anything, it can validate wiring, decide creation order, edit recipes, and wrap objects. A new inside a constructor gives it none of that.
7.2 Public contract vs. current implementation detail
Throughout this series, internals are tagged. The distinction matters because you may rely on one and must not rely on the other.
Public contract (documented, stable)
Current implementation detail (may change between versions)
BeanFactory and ApplicationContext interfaces and their documented behavior
DefaultListableBeanFactory as the workhorse behind most contexts
BeanDefinition as the metadata abstraction
The exact sequence of private steps inside AbstractApplicationContext.refresh()
Documented lifecycle callback order
Which internal helper classes parse annotations (for example the configuration-class post-processor)
Singleton scope means one shared instance per container
Internal cache structures used to track singletons

7.3 Spring is a library first
A common misconception is that Spring needs an application server. It does not. In the examples below, your main method creates the container (new AnnotationConfigApplicationContext(...)). No server is started, no deployment descriptor is read. Spring is a library on your classpath. Spring Boot's embedded web server is something Boot adds on top.

8. XML Configuration
Legacy / historical configuration: XML was the original way to configure Spring (since 1.0). It is still supported and you will meet it in existing codebases, but most new Spring code uses Java Configuration or annotations. We use it here because it is the clearest picture of "configuration as pure metadata, separate from code".
We reuse the plain domain classes from Section 4.3 with zero changes. Notice again that they have no Spring imports.
File: src/main/resources/blog01/beans.xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
                           https://www.springframework.org/schema/beans/spring-beans.xsd">

    <bean id="paymentGateway"
          class="com.example.springcore.blog01.domain.StripePaymentGateway"/>

    <bean id="paymentService"
          class="com.example.springcore.blog01.domain.PaymentService">
        <constructor-arg ref="paymentGateway"/>
    </bean>

    <bean id="orderService"
          class="com.example.springcore.blog01.domain.OrderService">
        <constructor-arg ref="paymentService"/>
    </bean>

</beans>
File: src/main/java/com/example/springcore/blog01/xml/XmlConfigApp.java
package com.example.springcore.blog01.xml;

import com.example.springcore.blog01.domain.OrderService;
import org.springframework.context.support.ClassPathXmlApplicationContext;

import java.math.BigDecimal;
import java.util.Arrays;

public class XmlConfigApp {

    public static void main(String[] args) {
        System.out.println("=== Blog 01 - XML Configuration ===");

        try (ClassPathXmlApplicationContext context =
                     new ClassPathXmlApplicationContext("blog01/beans.xml")) {

            String[] beanNames = Arrays.stream(context.getBeanDefinitionNames())
                    .filter(name -> !name.contains("."))   // hide Spring's internal infrastructure beans
                    .sorted()
                    .toArray(String[]::new);
            System.out.println("Application beans: " + Arrays.toString(beanNames));

            OrderService orderService = context.getBean("orderService", OrderService.class);
            orderService.placeOrder("ORD-1001", new BigDecimal("49.99"));

            System.out.println("Same instance on repeated lookup: "
                    + (orderService == context.getBean(OrderService.class)));
        }
    }
}
Line-by-line, the important parts
<bean id="paymentGateway" class="...">: Register one bean definition named paymentGateway, whose class is StripePaymentGateway. The id is the bean name, not a Java variable name.
<constructor-arg ref="paymentGateway"/>: "When building this bean, pass the bean named paymentGateway to its constructor". ref means reference to another bean by name.
new ClassPathXmlApplicationContext("blog01/beans.xml"): Create the container, load that classpath resource, parse it, and start the context (refresh()), all in one constructor call.
getBean("orderService", OrderService.class): Ask the container for the bean by name and expected type.
try (...) works because the context is Closeable. Closing the context runs destruction callbacks.
Mechanism breakdown
What is being configured? Three bean definitions and how their constructors are satisfied.
Where does the metadata live? In a separate XML resource on the classpath. The Java classes know nothing about it.
How does Spring discover it? You tell it explicitly by passing the resource path when creating the context. Nothing is discovered automatically.
How does the container interpret it? An XML bean definition reader parses each <bean> element into a BeanDefinition: class name (a string at this point), constructor arguments, and a reference to another bean by name. Class names are resolved to actual classes when the bean is created. Then the container builds objects from those definitions.
Trade-offs & Modern relevance
Advantages: Wiring visible in one file; works for classes you cannot annotate (third-party libraries); no coupling of domain code to Spring.
Disadvantages: Verbose; no compile-time checking; refactoring (renaming a class) does not update XML unless your IDE supports it; large XML files become hard to navigate.
Modern relevance: Still supported, mostly seen in existing systems. Essential for reading and maintaining legacy codebases.

9. Java Configuration
Same three beans, same domain classes, but the metadata is now written in Java.
File: src/main/java/com/example/springcore/blog01/javaconfig/JavaAppConfig.java
package com.example.springcore.blog01.javaconfig;

import com.example.springcore.blog01.domain.OrderService;
import com.example.springcore.blog01.domain.PaymentGateway;
import com.example.springcore.blog01.domain.PaymentService;
import com.example.springcore.blog01.domain.StripePaymentGateway;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JavaAppConfig {

    @Bean
    public PaymentGateway paymentGateway() {
        return new StripePaymentGateway();
    }

    @Bean
    public PaymentService paymentService(PaymentGateway paymentGateway) {
        return new PaymentService(paymentGateway);
    }

    @Bean
    public OrderService orderService(PaymentService paymentService) {
        return new OrderService(paymentService);
    }
}
File: src/main/java/com/example/springcore/blog01/javaconfig/JavaConfigApp.java
package com.example.springcore.blog01.javaconfig;

import com.example.springcore.blog01.domain.OrderService;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.math.BigDecimal;
import java.util.Arrays;

public class JavaConfigApp {

    public static void main(String[] args) {
        System.out.println("=== Blog 01 - Java Configuration ===");

        try (AnnotationConfigApplicationContext context =
                     new AnnotationConfigApplicationContext(JavaAppConfig.class)) {

            String[] beanNames = Arrays.stream(context.getBeanDefinitionNames())
                    .filter(name -> !name.contains("."))
                    .sorted()
                    .toArray(String[]::new);
            System.out.println("Application beans: " + Arrays.toString(beanNames));

            OrderService orderService = context.getBean("orderService", OrderService.class);
            orderService.placeOrder("ORD-1001", new BigDecimal("49.99"));

            System.out.println("Same instance on repeated lookup: "
                    + (orderService == context.getBean(OrderService.class)));
        }
    }
}
Line-by-line, the important parts
@Configuration marks the class as a source of bean definitions.
Each @Bean method is a recipe: the method name becomes the bean name (paymentGateway, paymentService, orderService), the return type is the bean's type, and the method body says how to build it.
Method parameters are dependencies. paymentService(PaymentGateway paymentGateway) tells the container "to call this method, first give me a PaymentGateway bean". You never call these methods yourself.
new AnnotationConfigApplicationContext(JavaAppConfig.class): Create the container, register the class as configuration metadata, and refresh.
The output will list javaAppConfig: the configuration class is itself a bean.
You could also write new PaymentService(paymentGateway()), calling the other @Bean method directly. Spring still returns the shared bean because @Configuration classes are specially enhanced. The parameter style shown above is clearer and does not depend on that mechanism. Blog 29 explains this enhancement, including proxyBeanMethods.
Mechanism breakdown
What is being configured? The same three bean definitions.
Where does the metadata live? In a Java class, separate from the domain classes but written in the same language.
How does Spring discover it? You pass the class to the context constructor. It is still explicit.
How does the container interpret it? A configuration-class post-processor (an internal infrastructure bean) reads the class and registers a BeanDefinition for each @Bean method, with the config class as the factory and the method as the factory method. Instantiation then calls those methods, resolving parameters from other beans.
Trade-offs & Modern relevance
Advantages: Type-safe, refactor-friendly, debuggable like any Java code; keeps domain classes clean.
Disadvantages: Wiring is still written by hand (one method per bean); metadata and classes live in separate places.
Modern relevance: The standard choice for explicit wiring and for configuring third-party or infrastructure objects. Spring Boot's auto-configuration is written as Java configuration.

10. Annotation Configuration
Here the metadata moves onto the classes themselves, so this style needs its own copies of the domain classes, now annotated. They live in a separate package so the three examples stay independent.
File: src/main/java/com/example/springcore/blog01/annotation/PaymentGateway.java
package com.example.springcore.blog01.annotation;

import java.math.BigDecimal;

public interface PaymentGateway {

    void charge(String orderId, BigDecimal amount);
}
File: src/main/java/com/example/springcore/blog01/annotation/StripePaymentGateway.java
package com.example.springcore.blog01.annotation;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class StripePaymentGateway implements PaymentGateway {

    @Override
    public void charge(String orderId, BigDecimal amount) {
        System.out.println("[Stripe] Charging " + amount + " for order " + orderId);
    }
}
File: src/main/java/com/example/springcore/blog01/annotation/PaymentService.java
package com.example.springcore.blog01.annotation;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class PaymentService {

    private final PaymentGateway paymentGateway;

    public PaymentService(PaymentGateway paymentGateway) {
        this.paymentGateway = paymentGateway;
    }

    public void pay(String orderId, BigDecimal amount) {
        if (amount.signum() <= 0) {
            throw new IllegalArgumentException("Amount must be positive: " + amount);
        }
        paymentGateway.charge(orderId, amount);
        System.out.println("[PaymentService] Payment accepted for " + orderId);
    }
}
File: src/main/java/com/example/springcore/blog01/annotation/OrderService.java
package com.example.springcore.blog01.annotation;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class OrderService {

    private final PaymentService paymentService;

    public OrderService(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    public void placeOrder(String orderId, BigDecimal amount) {
        System.out.println("[OrderService] Placing order " + orderId);
        paymentService.pay(orderId, amount);
        System.out.println("[OrderService] Order " + orderId + " confirmed");
    }
}
File: src/main/java/com/example/springcore/blog01/annotation/AnnotationAppConfig.java
package com.example.springcore.blog01.annotation;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@ComponentScan(basePackageClasses = AnnotationAppConfig.class)
public class AnnotationAppConfig {
}
File: src/main/java/com/example/springcore/blog01/annotation/AnnotationConfigApp.java
package com.example.springcore.blog01.annotation;

import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.math.BigDecimal;
import java.util.Arrays;

public class AnnotationConfigApp {

    public static void main(String[] args) {
        System.out.println("=== Blog 01 - Annotation Configuration ===");

        try (AnnotationConfigApplicationContext context =
                     new AnnotationConfigApplicationContext(AnnotationAppConfig.class)) {

            String[] beanNames = Arrays.stream(context.getBeanDefinitionNames())
                    .filter(name -> !name.contains("."))
                    .sorted()
                    .toArray(String[]::new);
            System.out.println("Application beans: " + Arrays.toString(beanNames));

            OrderService orderService = context.getBean("orderService", OrderService.class);
            orderService.placeOrder("ORD-1001", new BigDecimal("49.99"));

            System.out.println("Same instance on repeated lookup: "
                    + (orderService == context.getBean(OrderService.class)));
        }
    }
}
Line-by-line, the important parts
@Component on a class means "register this class as a bean definition". The default bean name is the class name with a lowercase first letter (orderService, stripePaymentGateway).
@ComponentScan(basePackageClasses = AnnotationAppConfig.class) tells the container to scan the package of that class and its sub-packages for annotated classes.
There is no wiring code at all. PaymentService has one constructor with a PaymentGateway parameter. When a class has a single constructor, Spring uses it for dependency injection without @Autowired. The container finds the only PaymentGateway bean (stripePaymentGateway) by type and passes it in.
AnnotationAppConfig is empty. It exists only to carry @ComponentScan and to give the context a starting point.
Mechanism breakdown
What is being configured? Which classes are beans. Dependencies are inferred from constructor parameter types.
Where does the metadata live? On the classes, as annotations.
How does Spring discover it? By classpath scanning: it walks the base package, reads class-file metadata, and finds classes carrying @Component (or annotations meta-annotated with it).
How does the container interpret it? Each candidate class becomes a BeanDefinition (bean name from the class name, constructor from the class), and dependencies are resolved by type at creation time.
Trade-offs & Modern relevance
Advantages: Least boilerplate; fast to write; scales well to many classes.
Disadvantages: Framework coupling in domain classes; wiring is less visible; scanning too broadly can register unintended beans; ambiguity errors when multiple implementations exist (Blog 12).
Modern relevance: The dominant style for application classes you own, usually combined with Java Configuration for infrastructure and third-party beans.

11. Compare the Three Approaches
Aspect
XML Configuration
Java Configuration
Annotation Configuration
Configuration location
Separate XML file
Separate Java class (@Configuration)
On the classes themselves (@Component)
How Spring finds it
You pass the file path to the context
You pass the class to the context
Component scanning of base packages
Wiring expressed as
<constructor-arg ref="...">
@Bean method parameters
Constructor parameter types (implicit)
Type safety
None. Strings, checked at runtime
Full compile-time checking
Compile-time for code; bean selection by type at runtime
Readability at scale
Verbose; navigation gets hard
Good; the graph is explicit in one place
Compact, but the whole graph is not visible in one place
Refactoring
Weak (string class names)
Strong (IDE and compiler)
Strong
Domain classes depend on Spring?
No
No
Yes (annotations)
Third-party classes
Yes
Yes
No (cannot annotate them)
Runtime metadata
BeanDefinitions from parsed XML
BeanDefinitions from @Bean methods
BeanDefinitions from scanned classes
Modern usage
Legacy, mostly maintenance
Standard for infrastructure and third-party beans
Standard for application classes
Best use case
Reading or maintaining older systems
Explicit, type-safe wiring and external classes
Many app-owned classes with minimal ceremony

Whatever the style, the runtime metadata row is the same idea: all three end up as BeanDefinitions in the container. That is why the container behaves identically regardless of how you configured it.

12. Complete Working Example
12.1 Project structure
spring-core-learning/
├── pom.xml
└── src/
    └── main/
        ├── java/
        │   └── com/example/springcore/blog01/
        │       ├── plain/
        │       │   ├── TightlyCoupledApp.java        (Section 4.1)
        │       │   └── ManualWiringApp.java          (Section 4.3)
        │       ├── domain/                            (Section 4.3, no Spring imports)
        │       │   ├── PaymentGateway.java
        │       │   ├── StripePaymentGateway.java
        │       │   ├── PaymentService.java
        │       │   └── OrderService.java
        │       ├── xml/
        │       │   └── XmlConfigApp.java             (Section 8)
        │       ├── javaconfig/
        │       │   ├── JavaAppConfig.java            (Section 9)
        │       │   └── JavaConfigApp.java            (Section 9)
        │       └── annotation/                        (Section 10, annotated copies)
        │           ├── PaymentGateway.java
        │           ├── StripePaymentGateway.java
        │           ├── PaymentService.java
        │           ├── OrderService.java
        │           ├── AnnotationAppConfig.java
        │           └── AnnotationConfigApp.java
        └── resources/
            └── blog01/
                └── beans.xml                          (Section 8)
12.2 pom.xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
                             https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>spring-core-learning</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>jar</packaging>
    <name>spring-core-learning</name>

    <properties>
        <maven.compiler.release>17</maven.compiler.release>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <spring.version>7.0.8</spring.version>
    </properties>

    <dependencies>
        <!-- Brings in spring-beans, spring-core, spring-aop and spring-expression transitively -->
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-context</artifactId>
            <version>${spring.version}</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <!-- Lets us run any main class with: mvn compile exec:java -Dexec.mainClass=... -->
            <plugin>
                <groupId>org.codehaus.mojo</groupId>
                <artifactId>exec-maven-plugin</artifactId>
                <version>3.5.0</version>
            </plugin>
        </plugins>
    </build>
</project>
12.3 Running each example
From the project root:
mvn -q compile exec:java -Dexec.mainClass=com.example.springcore.blog01.plain.TightlyCoupledApp
mvn -q compile exec:java -Dexec.mainClass=com.example.springcore.blog01.plain.ManualWiringApp
mvn -q compile exec:java -Dexec.mainClass=com.example.springcore.blog01.xml.XmlConfigApp
mvn -q compile exec:java -Dexec.mainClass=com.example.springcore.blog01.javaconfig.JavaConfigApp
mvn -q compile exec:java -Dexec.mainClass=com.example.springcore.blog01.annotation.AnnotationConfigApp
12.4 Expected output
XmlConfigApp:
=== Blog 01 - XML Configuration ===
Application beans: [orderService, paymentGateway, paymentService]
[OrderService] Placing order ORD-1001
[Stripe] Charging 49.99 for order ORD-1001
[PaymentService] Payment accepted for ORD-1001
[OrderService] Order ORD-1001 confirmed
Same instance on repeated lookup: true
JavaConfigApp:
=== Blog 01 - Java Configuration ===
Application beans: [javaAppConfig, orderService, paymentGateway, paymentService]
[OrderService] Placing order ORD-1001
[Stripe] Charging 49.99 for order ORD-1001
[PaymentService] Payment accepted for ORD-1001
[OrderService] Order ORD-1001 confirmed
Same instance on repeated lookup: true
AnnotationConfigApp:
=== Blog 01 - Annotation Configuration ===
Application beans: [annotationAppConfig, orderService, paymentService, stripePaymentGateway]
[OrderService] Placing order ORD-1001
[Stripe] Charging 49.99 for order ORD-1001
[PaymentService] Payment accepted for ORD-1001
[OrderService] Order ORD-1001 confirmed
Same instance on repeated lookup: true
Three things to notice:
The business output is identical across all three styles. Only how the objects were described differs.
The bean names differ: paymentGateway (chosen by you in XML and Java) vs stripePaymentGateway (generated from the class name by scanning).
Same instance ... true: Asking twice returns the same object. Beans are singletons by default.

13. Execution Flow
Here is what happens when JavaConfigApp.main() runs. Steps marked (implementation detail) may change between Spring versions.
The JVM starts main and prints the header.
new AnnotationConfigApplicationContext(JavaAppConfig.class) begins. (Implementation detail) The constructor creates the underlying bean factory and a definition reader, registers Spring's internal annotation-processing infrastructure as beans, registers JavaAppConfig as a bean definition named javaAppConfig, then calls refresh().
During refresh(), the configuration-class post-processor parses JavaAppConfig. Each @Bean method becomes a BeanDefinition: bean name = method name, factory bean = javaAppConfig, factory method = that method. Still no application objects.
Bean post-processors are registered so they can observe every bean created afterward.
The container pre-instantiates all non-lazy singleton beans. It needs javaAppConfig first, as it is the factory. Then, for paymentGateway, it calls paymentGateway(). For paymentService, it sees the parameter type PaymentGateway, finds the paymentGateway bean, and calls paymentService(gateway). For orderService, the same again with PaymentService. Dependencies always exist before their dependents. Creation order is driven by the dependency graph.
Refresh completes and the context publishes a "context refreshed" event.
getBeanDefinitionNames() is filtered and printed.
getBean("orderService", OrderService.class) returns the already-created singleton. Nothing new is constructed.
placeOrder(...) runs. This is ordinary Java. The container is not involved in the method call, since this bean is not wrapped by any proxy.
The == check prints true because both lookups return the exact same instance.
Leaving the try block calls context.close(). The context shuts down and destroys singleton beans. The program exits.
How the other two differ
Step
XML
Annotation
Context creation
ClassPathXmlApplicationContext("blog01/beans.xml") loads and parses the XML
AnnotationConfigApplicationContext(AnnotationAppConfig.class) registers the config class
Metadata to definitions
XML reader turns each <bean> into a BeanDefinition
Config-class post-processor sees @ComponentScan, scans the package, and registers a definition per @Component class
Dependency resolution
constructor-arg ref names the exact bean
Constructor parameter type is matched against candidate beans
Steps 5 to 11
Same
Same


14. Common Mistakes
Mistake 1: Creating a managed object with new and expecting injection
@Component
public class ReportJob {

    @Autowired
    private OrderService orderService;

    public void run() {
        orderService.placeOrder("ORD-9", new BigDecimal("5.00"));   // NullPointerException
    }
}

// Elsewhere in code:
ReportJob job = new ReportJob();
job.run();
What's wrong: @Autowired is only processed for objects the container creates. new ReportJob() produces an ordinary object outside the container, so orderService stays null.
Why it happens: Developers assume the annotation "magically" injects into any class. It doesn't—it is metadata that the container acts on when it creates the bean.
Fix: Obtain ReportJob from the container, or inject it into another bean. Never new a class that relies on container-provided dependencies.
Mistake 2: Scanning the wrong package
@Configuration
@ComponentScan("com.example.springcore.blog01.annotation.impl")   // no such package
public class BrokenConfig {
}
What's wrong: Scanning covers only the named package and its sub-packages. Here it finds nothing, so no beans are registered.
Why it happens: Package renames, or a config class placed somewhere unrelated to the components.
Fix: Use basePackageClasses (type-safe, survives renames) or correct the package string.
Mistake 3: A typo in an XML resource path or class name
new ClassPathXmlApplicationContext("beans.xml");   // file is actually at blog01/beans.xml
What's wrong: The resource is not at the classpath root.
Why it happens: XML metadata is string-typed, so nothing checks it before runtime.
Fix: Match the path to the file location under src/main/resources.
Mistake 4: Creating a new context repeatedly
public void handleRequest() {
    ApplicationContext ctx = new AnnotationConfigApplicationContext(JavaAppConfig.class);
    ctx.getBean(OrderService.class).placeOrder("ORD-1", new BigDecimal("1.00"));
}
What's wrong: Every call builds a full container and a fresh set of "singletons", then leaks it because it is never closed.
Why it happens: Treating the context as a helper utility rather than the application's object graph.
Fix: Create one context at application startup, hold it for the application's lifetime, and close it on shutdown.
Mistake 5: Adding Spring Boot to a Core experiment
What's wrong: Adding spring-boot-starter to test a container concept causes Boot's auto-configuration to silently register dozens of extra beans and behaviors.
Why it happens: Boot is what most tutorials use, so it feels like "the" way to run Spring.
Fix: When learning the container, use spring-context alone. Add Boot back once you can tell which behavior belongs to the container and which to auto-configuration.

15. Interview Questions
Beginner
What is Spring?
Spring Framework is a Java application framework built around an IoC container that creates, wires and manages your objects. On top of that container it provides modules for AOP, transactions, data access, web and messaging.
What is Inversion of Control?
The principle that the responsibility for creating objects and connecting them moves out of your business classes and into a framework or container.
What is Dependency Injection?
A technique for implementing IoC in which an object receives its collaborators from outside (via constructor, setter or field) rather than creating or looking them up itself.
What is the difference between Spring Framework and Spring Boot?
Spring Framework is the foundation (the container and the modules). Spring Boot is a layer on top that provides auto-configuration, starters, an embedded server and production tooling. Boot uses the Framework; it does not replace it.
What is a Spring bean?
An object that is instantiated, assembled and managed by the Spring IoC container, as described by a bean definition.
Intermediate
Is Spring MVC the same as Spring Framework?
No. Spring MVC is one web module (spring-webmvc) inside Spring Framework. You can use the Framework's container without any web module at all.
Why was Spring created as an alternative to EJB 2.x?
EJB 2.x components were invasive, needed XML descriptors, located collaborators through JNDI strings, and were hard to test outside an application server. Spring offered POJOs wired by a lightweight container that ran and tested without a server.
Can you use Spring without Spring Boot? Without XML? Without an application server?
Yes to all three. The examples in this blog use only spring-context, configure with Java or annotations, and run from a plain main method.
What does manual DI solve, and what does it not solve?
It removes hard-wired new calls, makes dependencies explicit, and lets you substitute collaborators in tests. It does not solve wiring volume, creation ordering, sharing decisions, lifecycle management, environment-specific configuration, or cross-cutting behavior.
What does it mean that Spring is "non-invasive"?
Your domain classes do not have to extend Spring classes or implement Spring interfaces.
Advanced
How does DI concretely improve testability?
Because a class receives its collaborators, a unit test can construct it with a fake or stub (e.g., using a lambda) and never touch a real gateway, database, or network.
What are the trade-offs between a runtime DI container like Spring and compile-time DI tools such as Dagger?
Runtime containers offer flexibility: reflection-based discovery, profiles, post-processors, proxies, dynamic behavior, at the cost of startup time and errors found at startup. Compile-time DI generates wiring code ahead of time, catching missing bindings during compilation and minimizing startup overhead.
Is Spring's DI the same as Jakarta CDI or jakarta.inject?
They solve the same problem with different implementations. Spring supports standard jakarta.inject annotations (@Inject, @Named), but the container, scopes, lifecycle, and extension models are Spring's.
Beans are singletons by default. What does that imply for design?
The same instance is shared by every thread that uses it, so singleton beans should be stateless or otherwise thread-safe. Mutable per-request state belongs in method parameters or another scope.
When would you choose plain Java DI over Spring?
For small applications, CLI tools, libraries, or wherever startup time and dependency footprint dominate.
Internals / Architecture
Which modules make up the core container?
spring-core, spring-beans, spring-context, spring-expression, plus the small spring-jcl logging bridge.
What are the two main container interfaces, and how do they relate?
BeanFactory is the basic container contract. ApplicationContext extends it and adds enterprise features: events, resource loading, message resolution, environment abstraction, and automatic post-processor handling.
What does the container do between "configuration loaded" and "your code calls getBean"?
It registers bean definitions, lets bean-factory post-processors edit them, registers bean post-processors, and pre-instantiates non-lazy singletons in dependency order.
Why does Spring separate a BeanDefinition from the bean instance?
Holding the object graph as metadata before instantiation allows the container to validate wiring, compute creation order, apply configuration adjustments, and prepare decorators/proxies.
When you call a method on a bean, is the container involved?
Normally no. The call is direct Java execution unless the bean was wrapped in a proxy (e.g., for transactions or security).

16. Production Considerations
Maintainability: Keep domain classes container-agnostic where practical. Choose one dominant configuration style per project.
Testability: With constructor injection, unit tests can use new with fakes and never start a container. Reserve container-backed tests for integration testing.
Performance: Container cost is paid at startup. Per-call overhead is zero for un-proxied beans.
Lifecycle: The context's lifetime is the application's lifetime. Create it once, and close it on shutdown so destruction callbacks run.
Concurrency: Singleton beans are shared across threads. Keep them stateless or thread-safe.
Architecture: The container should live at the edge of your application. Business logic should not be aware that the container exists.
Anti-patterns to avoid from day one:
Injecting ApplicationContext everywhere to call getBean(...) (Service Locator anti-pattern).
Using new on classes that depend on container-provided collaborators.
Putting all wiring into one gigantic configuration file.
Treating annotations as magic instead of metadata.

17. When NOT To Use It
Spring is a strong default for backend applications, but it is not free:
Small programs and scripts: If the composition root fits on one screen, a container adds unnecessary dependencies.
Libraries: Do not force a container on library consumers. Accept dependencies via constructors.
Startup- or memory-critical environments: CLI tools and tiny serverless functions where cold-start overhead dominates.
Small teams with no cross-cutting needs: If you need no transactions, security layers, or externalized configs, container overhead offers little payoff.
Value objects and data carriers: Objects created per operation (orders, DTOs, entities) should be plain instances, not managed beans.

18. Key Takeaways
Tight coupling comes from classes creating their own collaborators with new.
J2EE-era development compounded this with invasive components, JNDI lookups, and container-dependent testing. Spring solved this with POJOs and a lightweight IoC container.
IoC is the principle; DI is the primary technique.
DI is a design pattern, not a Spring feature. You can do it manually, but scale brings lifecycle and wiring burdens.
Spring Framework is the foundation; Spring MVC is a web module; Spring Boot is opinionated automation; Spring Core is the container.
Definitions come before instances: The container parses recipes into BeanDefinitions before instantiating objects.
XML, Java Config, and Annotations are three syntaxes for creating the same BeanDefinition metadata.
Spring is a library that runs in any standard JVM main method without an application server.

19. Next Blog
Blog 2: IoC and DI Fundamentals.
In this blog we did dependency injection by hand and then let Spring do it. Blog 2 separates IoC and DI properly: what "control" existed before IoC, where it moves, constructor vs setter vs field injection, and how DI contrasts with the Service Locator and Factory patterns.

Practice Exercises
Exercise 1: Basic
Add a RazorpayPaymentGateway implementing PaymentGateway to the domain package (print [Razorpay] Charging ...). Make the XML example use it by changing only the class attribute of the paymentGateway bean. Then make the Java Configuration example use it by changing only the body of paymentGateway(). Run both. Which files did you touch? Did any of OrderService, PaymentService or the *App classes change?
Exercise 2: Intermediate
Add a NotificationService (prints [Notification] Confirmation sent for <orderId>) to domain, and inject it into OrderService so it is called after payment succeeds. Update all four places that wire objects: ManualWiringApp, beans.xml, JavaAppConfig, and the annotation package. Count how many files each style required you to change.
Exercise 3: Advanced
In JavaConfigApp, print context.getBean(JavaAppConfig.class).getClass(). The result is not JavaAppConfig. Predict why. Then change JavaAppConfig so paymentGateway() prints "creating gateway", and make paymentService() take no parameters and call paymentGateway() directly:
@Bean
public PaymentService paymentService() {
    return new PaymentService(paymentGateway());
}
Predict how many times "creating gateway" prints. Then change the annotation to @Configuration(proxyBeanMethods = false), predict again, and verify both.
Check your answer The class printed is a generated subclass (e.g. JavaAppConfig$$SpringCGLIB$$0): Spring enhances @Configuration classes so calls between @Bean methods are intercepted to return the container's existing singleton bean. With the default, "creating gateway" prints once, and PaymentService receives the shared container instance. With proxyBeanMethods = false, the class is not enhanced: the container calls paymentGateway() once to register the bean, and paymentService() calls it directly a second time, printing twice and passing a separate unmanaged instance. Blog 29 explains this mechanism.
Exercise 4: Debugging
This program compiles but fails at runtime. Diagnose it before running it, then run it to confirm.
File: src/main/java/com/example/springcore/blog01/broken/BrokenApp.java
package com.example.springcore.blog01.broken;

import com.example.springcore.blog01.annotation.OrderService;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;

public class BrokenApp {

    @Configuration
    @ComponentScan("com.example.springcore.blog01.annotation.impl")   // no such package
    static class BrokenConfig {
    }

    public static void main(String[] args) {
        try (AnnotationConfigApplicationContext context =
                     new AnnotationConfigApplicationContext(BrokenConfig.class)) {
            context.getBean(OrderService.class).placeOrder("ORD-1", new BigDecimal("1.00"));
        }
    }
}
Questions: What exception do you expect, and at which line does it occur? Why does the container start successfully but fail at getBean? Give two different fixes.
Check your answer Expected exception: NoSuchBeanDefinitionException (No qualifying bean of type ...annotation.OrderService available), thrown at context.getBean(OrderService.class).
Why it starts: Scanning an empty or non-existent package is legal in Spring; the container simply finds zero candidate components and starts without error. The failure occurs only when the application requests a bean that was never registered.
Fix 1: Set the scan path to the package containing the beans: @ComponentScan("com.example.springcore.blog01.annotation").
Fix 2 (Recommended): Use type-safe base package classes: @ComponentScan(basePackageClasses = OrderService.class).

Appendix: Series Roadmap
The full Spring Core series, in order. Time is reading + coding, in minutes.
Levels: 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced · ⚫ Internals / Architecture
#
Title
Level
Time
1
What Is Spring? (you are here)
🟢
30 + 15 = 45 min
2
IoC and DI Fundamentals
🟢
35 + 45 = 80 min
3
Beans and the Spring IoC Container
🟡
40 + 30 = 70 min
4
Building Spring from Scratch with Maven
🟢
25 + 45 = 70 min
5
XML, Java Config and Annotations Together
🟡
35 + 50 = 85 min
6
BeanFactory vs ApplicationContext
🟡
30 + 30 = 60 min
7
Aware Interfaces
🟡
35 + 40 = 75 min
8
Bean Creation and Initialization
🟡
40 + 45 = 85 min
9
Bean Lookup and Naming
🟡
30 + 35 = 65 min
10
Autowiring and Collaborators
🟡
40 + 50 = 90 min
11
Constructor vs Setter vs Field Injection
🟡
35 + 40 = 75 min
12
@Primary and @Qualifier
🟡
35 + 45 = 80 min
13
Collection, Generic and Optional Injection; @Order/@Priority
🟡
35 + 45 = 80 min
14
Circular Dependencies
🔴
45 + 50 = 95 min
15
Bean Scopes
🟡
40 + 50 = 90 min
16
Method Injection and @Lookup
🟡
30 + 40 = 70 min
17
ObjectProvider, ObjectFactory and Provider
🟡
30 + 40 = 70 min
18
Custom Bean Scopes
🔴
35 + 50 = 85 min
19
Complete Bean Lifecycle
🟡
35 + 45 = 80 min
20
Lazy Initialization and @DependsOn
🟡
25 + 30 = 55 min
21
Lifecycle, SmartLifecycle and Graceful Shutdown
🟡
30 + 40 = 70 min
22
BeanPostProcessor
🔴
40 + 55 = 95 min
23
Container Extension Points
🔴
45 + 60 = 105 min
24
How Spring AOP Uses BeanPostProcessor
🔴
40 + 55 = 95 min
25
FactoryBean
🟡
30 + 40 = 70 min
26
BeanDefinition
⚫
45 + 50 = 95 min
27
Programmatic Registration and BeanDefinitionRegistry
🔴
35 + 50 = 85 min
28
Annotation Processing Infrastructure
⚫
35 + 35 = 70 min
29
@Configuration and @Bean Semantics
🔴
40 + 45 = 85 min
30
Classpath Scanning
🟡
40 + 45 = 85 min
31
Custom Annotations and Stereotypes
🟡
30 + 45 = 75 min
32
Component Scanning Filters
🟡
30 + 45 = 75 min
33
@Import, ImportSelector and ImportBeanDefinitionRegistrar
🔴
40 + 55 = 95 min
34
Conditional Bean Registration
🔴
35 + 50 = 85 min
35
Environment Abstraction
🟡
40 + 45 = 85 min
36
@Value and Property Resolution
🟡
30 + 40 = 70 min
37
Type Conversion
🟡
35 + 45 = 80 min
38
SpEL Fundamentals
🟡
40 + 45 = 85 min
39
Resource Abstraction
🟢
30 + 40 = 70 min
40
Application Events
🟡
35 + 45 = 80 min
41
MessageSource and Internationalization
🟢
25 + 35 = 60 min
42
ApplicationContext Internal Architecture
⚫
40 + 20 = 60 min
43
ApplicationContext Implementations
🟡
30 + 40 = 70 min
44
ApplicationContext Hierarchy
🟡
30 + 40 = 70 min
45
Container Initialization (refresh)
⚫
45 + 45 = 90 min
46
Singleton Registry and Three-Level Cache
⚫
45 + 45 = 90 min
47
Dependency Resolution Internals
⚫
45 + 50 = 95 min
48
Spring Container Error Analysis
🔴
40 + 60 = 100 min
49
Spring Core Design Principles
⚫
35 + 10 = 45 min



