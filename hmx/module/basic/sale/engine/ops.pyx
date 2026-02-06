def do_sum(int n):
    cdef long s = 0
    cdef long i

    for i in range(n):
        s += i
    return s


def multiply(double a, double b):
    return a * b


cpdef void compute_subtotals(object records):
    cdef object r
    cdef double q, p
    for r in records:
        q = float(r.quantity)
        p = float(r.price)
        r.subtotal = q * p


cpdef list multiplies(list qty, list price):
    """
    Compute qty[i] * price[i] for all i and return a Python list.
    """
    cdef Py_ssize_t n = len(qty)
    cdef list result = [0.0] * n
    cdef Py_ssize_t i
    cdef double q, p

    for i in range(n):
        q = float(qty[i])
        p = float(price[i])
        result[i] = q * p

    return result
