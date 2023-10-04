# SQL 50练习题

这个是真的写SQL，刷SQL题，不是MySQL的索引事务锁存储引擎等知识。

## 表

学生 (s_id,s_name)

老师 (t_id,t_name)

课程 (c_id,c_name,**t_id**)

分数 (**s_id,c_id,**score)

# 题

### 1、输出01课程比02课程成绩高的学生信息

#### 自连接

```SQL
select 
	a.score,
	b.socre,
	c.*
from score a, score b , student c
where a.c_id = 01 and b.c_id = 02 and a.s_id = b.s_id and a.s_core > b.score and c.s_id = a.s_id

```

#### 把长形数据变成宽形数据

```sql
select
	a.s_id,
	case when a.c_id = 01 then a.score end
from score a
```

