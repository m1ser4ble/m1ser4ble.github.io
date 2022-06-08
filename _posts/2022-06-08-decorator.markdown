---
layout: single
title:  "Python syntax for noob"
date:   2022-05-29 15:30:09 +0900
categories: jekyll update
toc: true
toc_sticky: true

---


# with as 구문

python3 부터 나온 것으로 알고 있다. 객체의 scope 가 정해진다고 오해하는 경우가 있지만 실제로는 그렇지 않다. 
실제로 어떻게 동작하는지 확인해보도록 하자.

## 


```

# a simple file writer object
  
class MessageWriter(object):
    def __init__(self, file_name):
        self.file_name = file_name
      
    def __enter__(self):
        self.file = open(self.file_name, 'w')
        return self.file
  
    def __exit__(self):
        self.file.close()
  
# using with statement with MessageWriter
  
with MessageWriter('my_file.txt') as xfile:
    xfile.write('hello world')
```

# decorator @



# Reference
- https://builtin.com/software-engineering-perspectives/python-symbol
- https://www.geeksforgeeks.org/with-statement-in-python/
- https://stackoverflow.com/questions/6392739/what-does-the-at-symbol-do-in-python
