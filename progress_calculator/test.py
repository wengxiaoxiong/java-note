# 打开文件
file_name = "算法.txt"
with open(file_name, "r", encoding="utf-8") as file:
    lines = file.readlines()

total_seconds = 0  # 用于存储总时长的秒数

# 遍历文件内容，每两行为一组，解析时间信息并累加
for i in range(0, len(lines), 2):
    title_line = lines[i].strip()  # 标题行
    time_line = lines[i + 1].strip()  # 时间行

    # 解析分:秒格式的时间信息
    try:
        minutes, seconds = map(int, time_line.split(":"))
        total_seconds += minutes * 60 + seconds
    except ValueError:
        print(f"无法解析时间行: {time_line}")

# 将总秒数转换为小时、分钟、秒
total_minutes, remaining_seconds = divmod(total_seconds, 60)
total_hours, remaining_minutes = divmod(total_minutes, 60)

# 打印总时长
print(f"视频总时长为：{total_hours} 小时 {remaining_minutes} 分钟 {remaining_seconds} 秒")

