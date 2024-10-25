# Terminology

World : 보통 gpu 가 하나의 process 에 대응됨. 그 때, 전체 process 들이 포함된 group
Rank : 각 개별 id. local rank 라고 하면 하나의 노드(머신) 내에서의 id 를 의미. 어떤 집단이라 하면 그 집단에서의 id.
예를 들면, gpu 4개짜리 노드가 두개 있으면 전체 world 는 8개의 gpu 이며 각 id 는 \[0,1,2,3,4,5,6,7\] 임.
그럼 local id 는 \[0,1,2,3\]. 그럼 각 gpu 2개마다 어떤 연산의 집합이 된다고 하면
ex data parallel, DP group 에서의 dp rank 는 \[0,1\] \[0,1\] \[0,1\], \[0,1\], \[0,1\] \[0,1\] 이렇게 있을 것.

[DataParallelTraining](https://siboehm.com/articles/22/data-parallel-training)

[PipelineParallelism](https://siboehm.com/articles/22/pipeline-parallel-training)
https://afmck.in/posts/2023-02-26-parallelism/
