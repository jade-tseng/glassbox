"""Count primes below n. Deliberately naive starting point."""


def count_primes(n: int) -> int:
    count = 0
    for k in range(2, n):
        is_prime = True
        for d in range(2, k):
            if d * d > k:
                break
            if k % d == 0:
                is_prime = False
                break
        if is_prime:
            count += 1
    return count
