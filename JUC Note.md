# JUC学习笔记

# CH1-CH3 基础

## 创建线程

### 直接创建一个Thread

```java
    public static void main(String[] args) {
        Thread t = new Thread(){
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

### 两阶段终止

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

# CH4 共享模型之管程

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



### 自旋锁优化

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
