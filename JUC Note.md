#  JUC学习笔记

# CH1-CH3 基础

## 创建线程

### 直接创建一个Thread

```java
    public static void main(String[] args) {
        Thread t = new Thread(){
          	@override
            public void run(){
                System.out.println("Test");
            }
        };
      
        t.start();
   
    }
```

### Runnable

```java
public class Main {
    public static void main(String[] args) {
        Thread t = new Thread(new Working());
        
        t.start();
    }
    
    
}

class Working implements Runnable{

    @Override
    public void run() {
        System.out.println("测试");
    }
}
```

### 简化为Lambda

```java
public class Main {
    public static void main(String[] args) {
        Thread t = new Thread(()->{
            System.out.println("TEST");
        });

        t.start();
    }
```

Lambda和直接创建一个Thread的区别？上源码。

```java
public class Thread{
    /* What will be run. */
    private Runnable target;
  
     public Thread(Runnable target) {
        this(null, target, "Thread-" + nextThreadNum(), 0);
    }
  	
   /* 启动的时候先看看target有没有东西。调用其run方法 */
    @Override
    public void run() {
        if (target != null) {
            target.run();
        }
    }

}
```

- 解耦，继承Thread把线程和任务绑定在一起了，实现Runnable接口把线程和任务分开了
- 用runnable更容易与线程池的API相配合

### FutureTask

> 可以返回任务的执行结果

```java
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;

public class Main {
    public static void main(String[] args) throws ExecutionException, InterruptedException {
        FutureTask task = new FutureTask(new Callable<Integer>(){
            @Override
            public Integer call() throws Exception{
                System.out.println("before");
                Thread.sleep(10000);
                System.out.println("After");
                return 1;
            }
        });

        Thread t = new Thread(task);
        t.start();

        // 这里要等待任务结束，所以会阻塞
        Integer taskResult = (Integer) task.get();

        System.out.println(taskResult);

    }


}

```

## 线程运行原理

JVM内存模型中有方法区、栈、堆。那么栈区内存给谁用呢，其实就是线程，当一个线程被分配，JVM就会分配一个栈给线程。

- 栈由多个Frame组成，对应着每次调用时占用的内存
- 线程只能由一个活动栈帧，对应着正在执行的方法

### 运行机制补充知识

<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230922082309842.png" alt="image-20230922082309842" style="zoom:33%;" />

1. 当开始开始运行的时候，将类的字节码，放入到方法区。
2. 分配一个main线程栈，将局部变量args与堆中做关联。返回地址为空，因为运行结束没有可以返回的东西
3. 开始执行命令。这个是用程序计数器来决定执行什么东西

### 线程上下文切换

可能因为以下原因导致线程停止运行

1. 时间片到
2. 垃圾回收
3. 高优先级抢占
4. 线程调用了sleep yield join park synchornized lock方法

上下文切换，意味着你要保留当前线程的状态，这将会保存每个栈帧的信息、程序计数器，这是一个很消耗性能的操作

# 常用API

| 函数                 | 说明                                                    |
| -------------------- | ------------------------------------------------------- |
| start                | 执行run方法，后切换为就绪状态，只能一次                 |
| run                  | 重写不调用                                              |
| Join(long x)         | 等待任务结束，最多等待x秒                               |
| getter               | id state                                                |
| getter setter        | name priority                                           |
| isInterrupted()      | 被打断                                                  |
| isAlive()            | 运行完成没有                                            |
| static interrupted() | 当前运行的线程是否被打断                                |
| static currentThread | 获取当前正在运行的线程                                  |
| static sleep()       | 让当前运行的线程休眠x秒，进入time wating状态            |
| static yield()       | 提示线程调度器让出当前线程对cpu的使用，进入runnable状态 |

# 状态

NEW

RUNNABLE

RUNNING 

BLOCKED

WAITING

TIMED_WATING

## 同步问题

打印什么东西？是0还是100

```java

import static java.lang.Thread.sleep;

public class Main {
    public static void main(String[] args)  {
        test1();
    }
    
    public static int n = 0;

    private static void test1() {
        Thread t = new Thread(()->{
            System.out.println("替换之前");
            try {
                sleep(1);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
            n = 100;
            System.out.println("替换之后");
        });
        t.start();
      	//t.join()
        System.out.println(n);
    }
}
```

如果加了join，表示同步执行，需要返回异步结果才能继续执行。

### 一些碎片知识总结

#### sleep

1. sleep进入TIME WATING状态（一种阻塞状态
2. 打断sleep wait join的进程，会抛出IInterruptedException，isInterrupted()函数返回false
3. yield进入 RUNNABLE状态

### 面试题：两阶段终止

T1线程如何优雅的结束T2线程？如果直接执行stop方法，就真正意义上结束这个线程了，那么就无法释放资源，会出问题

主要思路：我们每次循环的时候判断线程是否被打断，如果打断标记为true，则释放锁，以及退出循环。被打断的时候有两种情况，1.睡眠中 2.正常执行中，我们在睡眠被打断的时候捕获异常，然后手动打断他，下一次循环的时候就会直接退出了。

<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230923072240678.png" alt="image-20230923072240678" style="zoom:50%;" />

```java
import java.util.concurrent.TimeUnit;

public class TwoPhaseTermination {
    public static void main(String[] args) throws InterruptedException {
        Monitor monitor = new Monitor();
        monitor.start();
        Thread.sleep(3500);
        monitor.terminate();
    }
}


class Monitor{
    private Thread thread;

    public void start(){
        thread = new Thread(()->{
            while(true){
                Thread cur = Thread.currentThread();
                System.out.println("执行监控记录");
                boolean flag = cur.isInterrupted();
                if(flag){
                    // 释放锁
                    System.out.println("被打断hh");
                    break;
                }
                try {
                    TimeUnit.SECONDS.sleep(1);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                    Thread.currentThread().interrupt();
                }
            }
        });


        thread.start();
    }


    public void terminate(){
        thread.interrupt();
    }


}

```

### 守护线程

通过setDaemon来设置为守护线程。守护线程默认会运行直到所有的非守护线程运行结束，所以这个程序五秒后就结束了

```java
import java.util.concurrent.TimeUnit;

public class DaemonTest {
    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(()->{
            while (true){
                System.out.println("执行");
                if(Thread.currentThread().isInterrupted()){
                    System.out.println("被打断了");
                    break;
                }
                try {
                    TimeUnit.SECONDS.sleep(1);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    e.printStackTrace();
                }
            }
        });
        // 设置为守护线程
        t1.setDaemon(true);
        t1.start();

        TimeUnit.SECONDS.sleep(5);
        System.out.println("结束");

    }
}

```

## 线程多状态

### 操作系统层面

1. 创建
2. 可运行
3. 运行
4. 阻塞
5. 结束

### JVM层面

| 状态        | 情况                                  |
| ----------- | ------------------------------------- |
| INIT        | 创建未开始                            |
| RUNNABLE    | 1. 可运行<br />2. 运行中<br />3. 阻塞 |
| BLOCKED     | 拿不到锁，阻塞                        |
| WATING      | join等待                              |
| TIME_WATING | 睡觉                                  |
| TERMINATED  | 结束                                  |



<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230923074538501.png" alt="image-20230923074538501" style="zoom:50%;" />

# CH4 管程并发-悲观锁（阻塞）

## 线程不安全的例子

视频中用一个有趣的例子解释了线程不安全，以下是线程不安全例子的代码，结果并不是0，可能是-2934 239 这种数字

```java
public class UnsafeThread {
    public static int counter = 0;
    public static void main(String[] args) throws InterruptedException {
        Thread thread1 = new Thread(()->{
            for (int i = 0; i < 5000; i++) {
                counter++;
            }
        });
        Thread thread2 = new Thread(()->{
            for (int i = 0; i < 5000; i++) {
                counter--;
            }
        });
        thread1.start();thread2.start();
        thread1.join();thread2.join();
        System.out.println(counter);
    }

}
```

### 问题分析

i++看起来是一条，但是会被jvm翻译为四条字节码指令，i--同理，也是四条。

```
getstatic i 
iconst_1
iadd
putstatic i
```

上下文切换，会导致指令交错，所以八条指令可能会被重新组合，导致结果不对。

### 临界区 Critical Section

一段代码对共享资源多线程进行读写操作，这段代码被称为临界区

竞态条件 Race Condition

多个线程在临界区操作，指令序列不同导致结果无法预测

## Synchronized解决问题

补充一些java语法的小知识

1. synchronized只能锁住对象，不能锁住基本数据类型
2. lambda表达式内不能操作局部变量，这是java中使用了pass-by-value的方式传递变量，包括全局变量和局部变量，所以必须用static int 传入类的指针指向的counter，才不会出问题。

```java
public class UnsafeThread {
    static Object lock = new Object();

    static int counter = 0;
    
    public static void main(String[] args) throws InterruptedException {
        
        Thread thread1 = new Thread(()->{
            for (int i = 0; i < 5000; i++) {
                synchronized (lock) {
                    counter++;
                }
            }
        });
        Thread thread2 = new Thread(()->{
            for (int i = 0; i < 5000; i++) {
                synchronized (lock){
                    counter--;
                }
            }
        });
        thread1.start();thread2.start();
        thread1.join();thread2.join();
        System.out.println(counter);
        
    }

}
```

锁在静态方法上

```java
public class Room{
	public synchronized static void tset(){
    //...
  }
}
// 等价
public class Room{
  	public static void tset(){
    	synchronized(Room.class	){
		}
  }
}
```

锁在普通方法上

```java
public class Room{
	public synchronized void tset(){
    //...
  }
}
// 等价
public class Room{
  	public void tset(){
    	synchronized(this){
        
		}
  }
}
```

## Monitor概念-深入Synchronized底层

在内存中，java对象由两个部分组成：1.对象头 2.对象的成员变量

### Java对象头

[JAVA对象布局之对象头(Object Header) - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/269720006)

以32位JVM举例：

<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230923153133147.png" alt="image-20230923153133147" style="zoom: 50%;" />

#### 1.Mark Word

这部分主要用来存储对象自身的运行时数据，如哈希码（HashCode）、GC分代年龄、锁状态标志、线程持有的锁、偏向线程ID、偏向时间戳等。

mark word的位长度为JVM的一个Word大小，也就是说32位JVM的Mark word为32位，64位JVM为64位。 为了让一个字大小存储更多的信息，JVM将字的最低两个位设置为标记位，不同标记位下的Mark Word示意如下：

每一个状态的时候，MarkWord长的不太一样，比如进入synchronized代码块，会从Normal->Heavyweight。具体的偏向锁、轻量级锁等概念还会再提及

![image-20230923160952152](/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230923160952152.png)

和操作系统一样，Monitor对象会维护一些队列

![image-20230923161553294](/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230923161553294.png)

#### 2. KlassPointer

指向了方法区内存中的类

<img src="https://pic3.zhimg.com/80/v2-911709cc96634ec0fa59233f97e8f302_1440w.webp" alt="img" style="zoom: 50%;" />

### 轻量级锁

通过刚才的学习我们知道，java中对象头有Markword，markword不同状态存储的信息不一样最后两个bit意味着锁的状态，01表示无锁，00表示轻量级锁，10表示重量级锁。

```java
import java.util.concurrent.TimeUnit;

public class DuplicateDemo {
    public static Lock lock = new Lock();
    public static void main(String[] args) {

        Thread thread = new Thread(()->{
            lock.method1();
        },"线程1");

        Thread thread2 = new Thread(()->{
            lock.method1();
        },"线程2");


        thread.start();
        thread2.start();
    }
}
class Lock{

    public synchronized void method1(){

        System.out.println(Thread.currentThread().getName()+"调用1");
        method2();
    }
    public synchronized void method2(){
        System.out.println(Thread.currentThread().getName()+"调用2");
    }

}
```

java中加锁的过程如下：
<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230923170742951.png" alt="image-20230923170742951" style="zoom:33%;" /> 加锁 <img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230923170725960.png" alt="image-20230923170725960" style="zoom:33%;" />

1. 线程调用method1函数，在线程自己的栈开一个栈帧，然后init一个LockRecord
2. 找到要锁住的对象，看他的Markword中的最后两个bit是不是01，如果是01代表还没被锁过
3. 用CAS交换方法，将自己LockRecord里面的Markword和对象的Markword替换掉。这个操作是原子性的

假如线程去访问锁对象的Markword的时候，最后两位已经00多的时候咋办？这意味锁已经被占用了，此时将会**锁膨胀**，等下会讲，我们先继续

4. 此时Markword最后两位是00，代表着已经上了一个轻量级锁
5. 接着，开始执行method2函数，再加一个栈帧，然后init一个LockRecord，值为null。因为轻量级锁的Markword的线程id是自己，所以不需要替换掉它。

### 锁膨胀

继续刚才那个加锁的过程，假如发现Markword已经是00了，那怎么办呢，这将会锁膨胀，将锁升级为重量级锁，具体过程如下：

为Object申请Monitor对象，将指向的地址更换，然后将自己加入到Monitor对象的Block队列

<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230923173148246.png" alt="image-20230923173148246" style="zoom: 33%;" /> 

此时，Markword指向Monitor锁的地址，然后最后两个bit为10，表示现在是一个重量级锁



### 面试题：自旋锁优化

w(){

​	s

}

```java
// 自旋锁伪代码：

Object lock = new Object()

new Thread(()->{
	while(true){
		synchronized(lock){
			//执行
			break;
		}
	}
	
}).start()
```

为了避免上下文一直切换，影响性能，所以可以使用自旋锁的方式来来等待另外一个线程释放自己需要的锁。		

### 偏向锁

偏向锁存在的意义是，为方便某个线程重复获取某个锁，不需要一直进行CAS操作，节省CPU开销，具体的方法是在Markword将后三位设置成101，并且在markword中标记自己的线程ID。

#### 取消偏向锁的情况

1. 如果有其他线程要占用这个锁，将会取消这个偏向锁，并且升级为轻量锁
2. 调用Hashcode函数，见Markword的图。
3. 当JVM进行垃圾收集时。在某些情况下，垃圾收集器可以决定撤销偏向锁，以便更有效地进行垃圾收集。
4. 某类型的偏向锁被撤销超过40次以后，此类的对象之后都是轻量锁，
5. Jvm启动前4秒刚创建的对象，都是轻量锁，过一段时间才会转换为偏向锁。这是因为撤销偏向锁的开销大
6. 使用wait notify，唤醒其他线程需要查看阻塞队列，这个队列只有重量级锁才会有的Monitor对象中，所以会撤销偏向锁，升级为重量级锁

### 批量重偏向

当一个类的锁被撤销超过20次，JVM 会觉得自己偏向错误了，接下来撤销偏向锁后，会将新占用的线程的线程ID替换上去

## Wait VS Notify

开头老师讲了一个搞笑的例子，建议读者去看看

<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230924185203922.png" alt="image-20230924185203922" style="zoom:33%;" /> 

#### wait()

获取锁对象的线程，主动调用wait()方法，会将自己加入到锁对象的WaitSet中，只能等待其他线程来唤醒，这是一种主动阻塞，此时进入WAIT状态，**会释放自己的锁**

#### notify() 和 notifyAll()

获取锁对象的线程，可以调用notify() notify All()方法，将waitSet中的线程重新回到EntryList

### 面试题：wait和sleep区别

1. wait是Object的方法，sleep是Thread
2. wait会释放锁，sleep不会释放锁
3. wait需要进入synchronized里才能用，sleep可以直接用
4. wait()是进入WAITING状态，wait(long n)和sleep进入了TIMED_WAITING状态

### 正确姿势

```java
public class Cigarette {
    static boolean hasCigarette = false;
    static boolean hasTakeout = false;

    public static void main(String[] args) {

        Object room = new Object();

        Thread thread1 = new Thread(()->{
            synchronized (room){
                while(!hasCigarette){
                    System.out.println("没有烟，不干活了");
                    try {
                        room.wait();
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
                System.out.println("有烟了，开始干活");
            }
        },"小男");

        Thread thread2 = new Thread(()->{
            synchronized (room){
                while(!hasTakeout){
                    System.out.println("没有饭，不干活了");
                    try {
                        room.wait();
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
                System.out.println("有饭了，开始干活");
            }
        },"小女");

        for(int i=0 ; i<5 ;i++){
            new Thread(()->{
                synchronized (room){
                    System.out.println("干活中");
                }
            }).start();
        }


        Thread takeoutStaff1 = new Thread(()->{
            try {
                Thread.sleep(2000);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
            synchronized (room){
                System.out.println("外卖员送烟来了");
                hasCigarette = true;
                room.notifyAll();
            }
        });
        Thread takeoutStaff2 = new Thread(()->{
            try {
                Thread.sleep(5000);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
            synchronized (room){
                System.out.println("外卖员送饭来了");
                hasTakeout = true;
                room.notifyAll();
            }
        });
        thread1.start();
        thread2.start();
        takeoutStaff1.start();
        takeoutStaff2.start();


    }
}
```

## 设计模式：保护性暂停

保护性暂停有什么用？线程的Join和Future就是通过这个实现，假如线程1想要获取到线程2的结果，他们就可以共同存储在一个对象之中。直到运行完成后，放入结果再来唤醒另外一个等待的线程

 ![image-20230929001547589](/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230929001547589.png)

```java
public class GuardSSuspendLearn {

    public static void main(String[] args) {
        Guard guard = new Guard();
        new Thread(()->{
            System.out.println("下载之前");
            final Integer object = (Integer) guard.getObject();
            System.out.println("下载得到了结果，值为" + object);
        }).start();

        new Thread(()->{
            try {
                Thread.sleep(10000);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
            guard.setObject(1);

        }).start();
    }
}
class Guard {
    private Object object;

    public Object getObject() {
        synchronized (this){
            while(object==null){
                try {
                    this.wait();
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }
            return object;
        }
    }

    public void setObject(Object object) {
        synchronized (this){
            this.object = object;
            this.notifyAll();
        }
    }
} 
```

我们可以去观看Join()的代码，如果t.join()，会不断调用t.wait(0)方法阻塞主线程，直到等待的线程运行完毕跳出唤醒主线程

```java
    public final synchronized void join(final long millis)
    throws InterruptedException {
        if (millis > 0) {
            if (isAlive()) {
                final long startTime = System.nanoTime();
                long delay = millis;
                do {
                    wait(delay);
                } while (isAlive() && (delay = millis -
                        TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTime)) > 0);
            }
        } else if (millis == 0) {
            while (isAlive()) {
                wait(0);
            }
        } else {
            throw new IllegalArgumentException("timeout value is negative");
        }
    }
```

### 面试题：生产者消费者，消息队列

```java
import java.util.LinkedList;
import java.util.Queue;

public class MessageQueue {

    static MQ mq =  new MQ(100);

    public static void main(String[] args) {

        for (int i = 0; i < 100; i++) {
            new Thread(()->{
                try {
                    Integer integer = mq.get();
                    System.out.println("消费者拿消息"+integer);
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            },i+"线程").start();
        }

        for (int i = 0; i < 100; i++) {
            new Thread(()->{
                System.out.println("生产者产生消息");
                try {
                    mq.put(1);
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            },i+"线程").start();
        }



    }
}


class MQ{
    private LinkedList<Integer> mq = new LinkedList<>();

    private Integer capacity = 0;

    public MQ(Integer capacity){
        this.capacity = capacity;
    }

    public Integer get() throws InterruptedException {
        synchronized (mq){
            while(mq.isEmpty()){
                mq.wait();
            }

            mq.notifyAll();
            capacity--;
            return mq.remove();

        }
    }

    public void put(Integer integer) throws InterruptedException {
        synchronized (mq){
            while(mq.size()==capacity){
                mq.wait();
            }

            mq.notifyAll();
            capacity++;
            mq.push(integer);
        }
    }

}
```

## Park & Unpark使用

```java
import java.util.concurrent.locks.LockSupport;

public class ParkTest {

    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(()->{
            try {
                Thread.sleep(2000);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
            System.out.println("park");
            LockSupport.park();
            System.out.println("resume");

        });
        t1.start();

        Thread.sleep(4000);
        System.out.println("unpark");
        LockSupport.unpark(t1);


    }
}
```

### 面试题：park&unpark和wait&notify区别

1. park来自juc的LockSupport的API，而wait notify来自Object类
2. park不需要获取锁才能使用，wait需要获取锁，在同步代码块内才能使用
3. park可以精确唤醒某一个进程，然而notify是随机唤醒一个进程
4. unpark可以先唤醒还没park的进程，等他真的park的瞬间unpark

### 原理:

每个线程都有自己的Parker对象，由三部分实现，counter condition mutex

<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230929162217632.png" alt="image-20230929162217632" style="zoom:50%;" />

视频中老师举了一个例子：线程是一个旅人，Parker对象是一个线程的背包，condition是一个帐篷，counter是干粮的意思，counter=0表示没干粮了，counter=1表示还有干粮，当调用park的时候，就会去包里看看干粮还有没有，没有的话就进帐篷休息，如果有干粮，就把干粮吃了，继续前行。unpark()这个方法就是给counter+1，让干粮充足。所以说有以下两种情况：

1. counter=0的时候调用了park()，没干粮了，线程只好停止运行，直到有人unpark()加了干粮，线程才会继续运行
2. counter=0的时候某个线程先unpark()给他加了干粮，线程在运行的期间park()了，发现还有干粮，于是继续运行。

这就是为什么线程可以提前调用unpark()

### 状态切换问题

<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230929164240689.png" alt="image-20230929164240689" style="zoom:67%;" />

### 多把锁

一个房间，可以做两件事，睡觉和读书，这两件事情不相关，不需要锁住整个房间，不然这样颗粒度太大了，可以尝试降低颗粒度，比如拆成读书锁和睡觉锁。

坏处：多锁问题可能会产生死锁

## 锁的活跃性

死锁、活锁、饥饿

### 死锁

#### 面试题：死锁的条件

请求与保持等待

循环依赖

不剥夺条件

互斥

#### 定位死锁

使用jconsole，定位进程id，再用jstack定位死锁，然后可以发现java-level DeadLock

### 活锁

两个线程互相改变对方的结束条件，导致无法结束，比如游泳池一边放水一边灌水问题。

A线程的任务是把水放光才能下班

B线程的任务是把水放满才能下班

结果两人都无法下班，这就是一个活锁问题。

### 饥饿

1. 优先级分配问题，导致优先级低的线程一直无法被获取CPU

2. 锁排序问题，一直抢不到锁，导致饥饿，比如哲学家就餐问题，总会一位一直吃不到饭

# ReentrantLock(可重入锁)

```java
import java.util.concurrent.locks.ReentrantLock;

public class LockTest {
    public static ReentrantLock reentrantLock = new ReentrantLock();

    public static void main(String[] args) {
        reentrantLock.lock();
        try {
            System.out.println("main1");
            main2();
        }finally {
            reentrantLock.unlock();
        }
    }

    public static void main2() {
        reentrantLock.lock();
        try {
            System.out.println("main2");
        }finally {
            reentrantLock.unlock();
        }
    }
}
```

## Feature

### 可打断

获取不到锁的时候可以选择不继续排队，如果是syn必须排队

```java
import java.util.concurrent.locks.ReentrantLock;

import static java.lang.Thread.sleep;

public class LockTest {
    public static ReentrantLock reentrantLock = new ReentrantLock();

    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(()->{
            try {
                System.out.println("尝试获取锁");
                reentrantLock.lockInterruptibly();
            } catch (InterruptedException e) {
                System.out.println("排队的过程被打断了");
                throw new RuntimeException(e);
            }
            try {
                System.out.println("main1");
                main2();
            }finally {
                reentrantLock.unlock();
            }
        },"t1");

        reentrantLock.lock();
        t1.start();
        sleep(1000);
        t1.interrupt();
    }

    public static void main2() {
        reentrantLock.lock();
        try {
            System.out.println("main2");
        }finally {
            reentrantLock.unlock();
        }
    }
}

```

### 可设置为公平锁

默认都是不公平锁，阻塞队列的线程会一拥而上抢锁。一般不会开启，会降低并发度

### 可以设置超时时间

```java
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

public class TryLockDemo {
    public static ReentrantLock lock = new ReentrantLock();

    public static void main(String[] args) {
        Thread t1 = new Thread(()->{
            try {
                if(lock.tryLock(1, TimeUnit.SECONDS)){
                    try{
                        System.out.println(Thread.currentThread().getName()+"获取锁了hh");
                    }finally {
                        System.out.println(Thread.currentThread().getName()+"释放锁");
                        lock.unlock();
                    }
                }else{
                    System.out.println(Thread.currentThread().getName()+"白等了一秒");
                    return;
                }
            } catch (InterruptedException e) {
                System.out.println(Thread.currentThread().getName()+"等待的时候被打断了");
                throw new RuntimeException(e);
            }
        },"t1");
        lock.lock();
        System.out.println("主线程先把锁抢了");
        t1.start();
    }
}

```

### 支持多个条件变量

在synchronized中，每个重量级锁的对象都有waitSet休息室，这个waitSet就是条件变量。但是休息室里的人wait的东西都不一样，有的人等烟，有的人等饭，ReentrantLock支持支持多了个条件变量，这样就可以唤醒制定的waitSet。用小南抽烟、小女吃饭举例子，FoodPanda松烟，UberEat送饭

```java
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

import static java.lang.Thread.sleep;

public class ConditionTest {
    static ReentrantLock lock = new ReentrantLock();
    static Condition cigarette = lock.newCondition();
    static Condition dinner = lock.newCondition();

    static Boolean hasCigarette = false;

    static Boolean hasDinner = false;

    public static void main(String[] args) {
        Thread xiaoNan = new Thread(()->{

            lock.lock();
            try{
                while(!hasCigarette) {
                    System.out.println("烟呢，草");
                    cigarette.await();
                }
                System.out.println("抽烟真爽啊");
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            } finally {
                lock.unlock();
            }

        },"小南");

        Thread xiaoNv = new Thread(()->{
            lock.lock();
            try{
                while(!hasDinner) {
                    System.out.println("饭呢，草");
                    dinner.await();
                }
                System.out.println("吃饭真爽啊");
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            } finally {
                lock.unlock();
            }
        },"小女");

        Thread foodPanda = new Thread(()->{
            lock.lock();
            try{
                try {
                    sleep(3000);
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
                System.out.println("烟来了");
                hasCigarette = true;
                cigarette.signalAll();
            }finally {
                lock.unlock();
            }
        },"送烟");

        Thread uberEats = new Thread(()->{
            lock.lock();
            try{
                try {
                    sleep(3000);
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
                System.out.println("饭来了");
                hasDinner = true;
                dinner.signalAll();
            }finally {
                lock.unlock();
            }
        },"送饭");

        xiaoNan.start();
        xiaoNv.start();
        foodPanda.start();
        uberEats.start();

    }
}

```

这里我踩了一个坑，两个外卖员我没有上锁，就开始唤醒线程了，这是一个错误的使用，不然会报错

```
烟呢，草
饭呢，草
烟来了
饭来了
Exception in thread "送烟" java.lang.IllegalMonitorStateException
	at java.base/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.signalAll(AbstractQueuedSynchronizer.java:1488)
	at ConditionTest.lambda$main$2(ConditionTest.java:59)
	at java.base/java.lang.Thread.run(Thread.java:833)
Exception in thread "送饭" java.lang.IllegalMonitorStateException
	at java.base/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.signalAll(AbstractQueuedSynchronizer.java:1488)
	at ConditionTest.lambda$main$3(ConditionTest.java:75)
	at java.base/java.lang.Thread.run(Thread.java:833)
```

## 面试题：同步模式顺序控制

控制线程的运行次序，轮流打印2和1

解法1：锁类

```java
    public static void main(String[] args) {
        new Thread(()->{
            while(true){
                synchronized (Test25.class){
                    System.out.println("2");
                    try {
                        Thread.sleep(1000);
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                }
            }
        }).start();
        new Thread(()->{
            while(true){
                synchronized (Test25.class){
                    System.out.println("1");
                    try {
                        Thread.sleep(1000);
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                }
            }
        }).start();
```

解法2：wait notify

```java
public class Test25 {

    public static Object lock = new Object();

    public static Boolean t2done = true;
    public static Boolean t1done = false;

    public static void main(String[] args)  {
        new Thread(()->{
            while(true){
                synchronized (lock){
                    while(!t2done){
                        try {
                            lock.wait();
                        } catch (InterruptedException e) {
                            throw new RuntimeException(e);
                        }
                    }
                    System.out.println("1");
                    t1done =true;
                    lock.notifyAll();
                    try {
                        lock.wait();
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                }
            }
        }).start();

        new Thread(()->{

            while(true){
                synchronized (lock){
                    while(!t1done){
                        try {
                            lock.wait();
                        } catch (InterruptedException e) {
                            throw new RuntimeException(e);
                        }
                    }
                    System.out.println("2");
                    t2done =true;
                    lock.notifyAll();
                    try {
                        lock.wait();
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                }
            }

        }).start();
    }
}

```

解法3 LockCondition 解法4Park 略

## 面试题：轮流输出ABC

### WaitNotify方法

```java
public class Test26 {
    public static void main(String[] args) {
        WaitNotify wn = new WaitNotify(0,100);
        new Thread(()->{
            try {
                wn.print(0,"a");
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }).start();
        new Thread(()->{
            try {
                wn.print(1,"b");
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }).start();
        new Thread(()->{
            try {
                wn.print(2,"c");
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }).start();

    }


}

class WaitNotify {
    private int flag;
    private int loopNumber;

    private int curNum = 0;

    public synchronized void print(int flag,String cur) throws InterruptedException {
        while(curNum<loopNumber){
            if(this.flag!=flag){
                wait();
            }
            System.out.println(cur);
            curNum++;
            this.flag = curNum % 3;
            notifyAll();
        }
    }

    WaitNotify(int flag, int loopNumber) {
        this.flag = flag;
        this.loopNumber = loopNumber;
    }
}
```

### Park&Unpark方法

```java
import java.util.concurrent.locks.LockSupport;

public class ParkUnparkTest {
    static Thread t1;
    static Thread t2;
    static Thread t3;
    public static void main(String[] args) {
        ParkUnpark unpark = new ParkUnpark(100);
         t1 = new Thread(()->{
            unpark.print("A",t1,t2);
        });
        t2 = new Thread(()->{
            unpark.print("B",t2,t3);
        });
        t3 = new Thread(()->{
            unpark.print("C",t3,t1);
        });
        t1.start();
        t2.start();
        t3.start();

        LockSupport.unpark(t1);
    }
}

class ParkUnpark{

    public ParkUnpark(int loopNumber) {
        this.loopNumber = loopNumber;
    }

    private int loopNumber;

    private int flag = 0;

    public void print(String cur,Thread park,Thread unpark){
        while(flag<loopNumber){
            LockSupport.park(park);
            System.out.println(cur);
            LockSupport.unpark(unpark);
            flag++;
        }

    }
}

```

### ReentrantLock Condition方法

```java
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.LockSupport;
import java.util.concurrent.locks.ReentrantLock;

public class ReentrantLockTest {
    public static void main(String[] args) {
        AwaitSignalAll as = new AwaitSignalAll(100);

        Condition a = as.newCondition();
        Condition b = as.newCondition();
        Condition c = as.newCondition();

        new Thread(()->{
            try {
                as.print("A",a,b);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }).start();

        new Thread(()->{
            try {
                as.print("B",b,c);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }).start();

        new Thread(()->{
            try {
                as.print("C",c,a);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }).start();

        as.lock();
        try{
            a.signalAll();
        }finally {
            as.unlock();
        }

    }
}

class AwaitSignalAll extends ReentrantLock {
    private int loopNumber;

    private int flag=0;

    public void print(String str,Condition cur,Condition next) throws InterruptedException {
        while(flag<loopNumber){
            lock();
            try{
                cur.await();
                System.out.println(str);
                next.signalAll();
                flag++;
            }finally {
                unlock();
            }
        }
    }

    public AwaitSignalAll(int loopNumber) {
        this.loopNumber = loopNumber;
    }
}
```

# CH5 JAVA内存模型

关注多个线程并发的时候的原子性，可见性，有序性

原子性：保证指令不会受到线程上下切换的影响

> synchronized、ReentrantLock来保证代码块内的操作是原子的

可见性：保证指令不会受CPU缓存指令的影响

> volatile来保证变量的可见性，但是不不保证原子性。可以使用synchronized来保证原子性和可见性，但是这个过于重量级。

有序性：保证指令不会受CPU并行优化影响

> 

## JMM

### INTRO

开头作者用一个代码举例子，看看这个线程会不会运行结束？

```java
public class VolatileTest {
    static boolean run = true;

    public static void main(String[] args) throws InterruptedException {
        new Thread(()->{
            while(run){

            }
        }).start();

        Thread.sleep(1000);
        System.out.println("设置为false");
        run = false;
    }
}

```

不会结束，因为为了提高运行效率，**Java 内存模型（JMM）** 抽象了线程和主内存之间的关系，就比如说线程之间的共享变量必须存储在主内存中。

如何破解？

解法一、加一个`volatile adj易变的;易挥发的`关键字可以保证可见性，线程每次访问这个变量的时候都会去主内存拉去

```java
public class VolatileTest {
    static volatile boolean run = true;

    public static void main(String[] args) throws InterruptedException {
        new Thread(()->{
            while(run){

            }
        }).start();

        Thread.sleep(1000);
        System.out.println("设置为false");
        run = false;
    }
}

```

解法二、用synchronized把他们包围，当一个线程进入 `synchronized` 代码块并获取锁后，它会清空本地线程栈中对共享变量的缓存，强制从主内存中重新读取共享变量的值。当线程释放锁时，它会将对共享变量的修改刷新到主内存，这样其他线程在获取锁并访问共享变量时就能看到最新的值，从而解决了变量可见性问题。

```java
public class VolatileTest {
    static volatile boolean run = true;
  
  	static Object lock = new Object();

    public static void main(String[] args) throws InterruptedException {
        new Thread(()->{
          	while(true){
              	synchronized(lock){
                  if(!run){
                    break;
                  }
								}
            }
        }).start();

        Thread.sleep(1000);
        System.out.println("设置为false");
     
        synchronized(lock){
   					run = false;
        }
      
    }
}

```

### 内存模型

在 JDK1.2 之前，Java 的内存模型实现总是从 **主存** （即共享内存）读取变量，是不需要进行特别的注意的。而在当前的 Java 内存模型下，线程可以把变量保存 **本地内存** （比如机器的寄存器）中，而不是直接在主存中进行读写。这就可能造成一个线程在主存中修改了一个变量的值，而另外一个线程还继续使用它在寄存器中的变量值的拷贝，造成数据的不一致。

这和我们上面讲到的 CPU 缓存模型非常相似。

**什么是主内存？什么是本地内存？**

- **主内存**：所有线程创建的实例对象都存放在主内存中，不管该实例对象是成员变量还是方法中的本地变量(也称局部变量)
- **本地内存**：每个线程都有一个私有的本地内存来存储共享变量的副本，并且，每个线程只能访问自己的本地内存，无法访问其他线程的本地内存。本地内存是 JMM 抽象出来的一个概念，存储了主内存中的共享变量副本。

有点像是CPU的高速缓存

<img src="https://oss.javaguide.cn/github/javaguide/java/concurrent/cpu-cache.png" alt="CPU 缓存模型示意图" style="zoom: 50%;" /><img src="https://oss.javaguide.cn/github/javaguide/java/concurrent/jmm.png" alt="JMM(Java 内存模型)" style="zoom:50%;" />

## 两阶段终止更新

这一次可以使用volatile的方式来获取run最近的状态。

```java
public class VolatileTest2 {
    static volatile boolean run = true;

    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(()->{
            while(true){
                if(!run){
                    System.out.println("停止监控，释放锁");
                    break;
                }
                System.out.println("执行监控任务");
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                }
            }
        });
        t1.start();

        Thread.sleep(1000);
        stop(t1);
    }

    public static void stop(Thread t1) {
        System.out.println("收到停止监控的通知");
        VolatileTest2.run = false;
        t1.interrupt();
    }
}
```

## 指令重排序

作者用了一个有趣的例子带大家了解了鱼罐头制作过程，我们可以并行做多件事情，CPU也可以并行执行几件事情，所以指令重排序可以提高cpu指令的吞吐量。JAVA同理，在不改变执行结果的情况下，JVM会对指令进行重新排序

<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230930163035305.png" alt="image-20230930163035305" style="zoom:50%;" />

比如说：

```java
int a = 1;
int b = 2;
System.out.println(a+b);

// 重排序后

int b = 2;
int a = 1;
System.out.println(a+b);
```

### 这会引发什么问题？

对于单线程而言，这并不会影响最终的执行结果。但是多线程可能就会出问题了

<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230930163453363.png" alt="image-20230930163453363" style="zoom:50%;" /> 可能出现的结果：1、4、0

虽然发生的几率低，但是高并发的情况下一定会有可能的。解决办法，在ready 前面加上volatile，原理后面解释

## Volatile原理如何保证可见性和有序性？

底层是用内存屏障技术（Memory Barrier）实现

- 对volatile变量的写指令写之后加入写屏障
- 对volatile变量的读指令读之前加入读屏障

<img src="/Users/wengxiaoxiong/Library/Application Support/typora-user-images/image-20230930195014186.png" alt="image-20230930195014186" style="zoom:50%;" />

写屏障之前的所有改动都会同步到主存，屏障之前的指令且不会指令重拍

读屏障之后的所有读取都会从主存中同步，屏障之后的指令且不会指令重拍

### Double Check Locking问题

> 单例很多实现，至少五种每个都要学会，就先不列了，自己看看设计模式

懒汉式单例，如何做到绝对的线程安全，解释有点复杂，自己看视频吧，多看几次，没法理解就强行背下吧。

```java
 public class Singleton implements Serializable{
    public volatile static final  Singleton INSTANCE;

    private Singleton() {
        
    }
   
    public Singleton getINSTANCE(){
        if(INSTANCE==null){
            synchronized (Singleton.class){ //创建对象的时候最多只能一个线程进去创建
                if(INSTANCE==null){
                    INSTANCE = new Singleton(); //这里可能指令重排，所以需要将INSTANCE设置为volatile防止指令重排
                }
            }
        } 
        return INSTANCE;
    }
   
   // 防止反序列破坏单例
   public Object readResovle(){
     	return INSTANCE;
   }
}
```

# CH6  无锁并发-乐观锁（非阻塞）

>  基于CAS和volatile实现无锁并发

## 本章内容

原子整数

原子引用

原子累加器

Unsafe

## Intro

在前面的学习，我们使用了悲观锁的方法，如synchronized和ReentrantLock来实现线程安全，从而达到多线程数据一致。但是使用锁对性能的开销比较大，会阻塞线程，然后上下文切换，这个代价太大了，所以我们使用乐观锁的方式来解决，主要的思想就是CAS，`AtomicInteegr`，`AtomicReference`，	`AtomicStampReference`、	`AtomicMakrableReference`都是用这个原理。

## AtomicInteger  银行账户案例

其他API也是大同小异，不写了

```java
import java.net.Inet4Address;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicInteger;

public class AtomicTest {
    public static void main(String[] args) throws InterruptedException {
        Account account = new Account(10000);
        System.out.println("提款之前"+account.getBalance());

        ArrayList<Thread> threads = new ArrayList<>();
        for(int i=0;i<10000;i++){
            threads.add(new Thread(()->{
                account.withdrawAPI(1);
            }));
        }

        threads.forEach(t->t.start());

        threads.forEach(t-> {
            try {
                t.join();
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        });

        System.out.println("提款之后"+account.getBalance());
    }
}

class Account{
    AtomicInteger balance;

    public Account(int balance) {
        this.balance = new AtomicInteger(balance);
    }

    public AtomicInteger getBalance() {
        return balance;
    }

    public void withdraw(int delta){
        while(true){
            final int prev = balance.get();
            final int next = prev-delta;
            if(next<0){
                return;
            }
            if(balance.compareAndSet(prev,next)){
                return;
            }
        }

    }

    public void withdrawAPI(int delta){
        balance.getAndUpdate(x->x-delta);
    }

}


```

## AtomicReference

除了可以基本类型，也可以使用引用类型，比较的是地址。还有支持版本，支持标记的，分别是AtomicStampReference和
