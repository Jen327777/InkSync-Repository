const ORDER_CHANNELS = ['Phone', 'Walk-in', 'Facebook Messenger', 'Email'];

const SERVICE_TYPES = [
  'Tarpaulin',
  'Document Printing',
  'Photocopy',
  'Business Cards',
  'Stickers',
  'Layout & Design',
  'Acrylic Signages',
  'Panaflex Signages',
  'Wall Mural Sticker',
  'Sticker Label',
  'Standee',
  'Sticker on Sintra',
  'Board Up Tarpaulin',
  'Lampost Banner',
  'Railing Streamer',
  'Luminous Signage',
  'Magnetic Signages'
];

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LINKED_FIELDS = {
  apply_discount: 'discount_amount',
  fulfillment_method: 'delivery_address',
  service_type: 'service_other'
};

const BACKEND_FIELD_HINTS = [
  [/customer_name/, 'customer_name'],
  [/customer_phone/, 'customer_phone'],
  [/customer_email|customer email/, 'customer_email'],
  [/order_channel/, 'order_channel'],
  [/service_type/, 'service_type'],
  [/quantity/i, 'quantity'],
  [/unit price/i, 'unit_price'],
  [/discount/i, 'discount_amount'],
  [/due.date/i, 'due_date'],
  [/fulfillment/i, 'fulfillment_method'],
  [/delivery.address/i, 'delivery_address'],
  [/description/, 'description']
];

const orderForm = document.getElementById('orderForm');
const orderDrawerEl = document.getElementById('orderDrawer');
const orderDrawer = bootstrap.Offcanvas.getOrCreateInstance(orderDrawerEl);
const orderFormError = document.getElementById('orderFormError');
const orderSaveBtn = document.getElementById('orderSaveBtn');
const serviceSelect = document.getElementById('serviceType');
const serviceOtherBox = document.getElementById('serviceOtherBox');
const addressBox = document.getElementById('addressBox');
const discountBox = document.getElementById('discountBox');
const totalPreview = document.getElementById('totalPreview');

function renderOptions() {
  document.getElementById('channelOptions').innerHTML = ORDER_CHANNELS.map((name, index) => (
    '<div class="form-check form-check-inline">' +
    '<input class="form-check-input" type="radio" name="order_channel" id="channel' + index + '" value="' + name + '">' +
    '<label class="form-check-label" for="channel' + index + '">' + name + '</label>' +
    '</div>'
  )).join('');

  serviceSelect.add(new Option('Select a service', ''));
  SERVICE_TYPES.forEach((name) => serviceSelect.add(new Option(name, name)));
  serviceSelect.add(new Option('Others', 'Others'));
}

function setError(name, message) {
  const holder = orderForm.querySelector('[data-error-for="' + name + '"]');
  if (holder) {
    holder.textContent = message || '';
    holder.classList.toggle('d-block', Boolean(message));
  }
  const control = orderForm.elements[name];
  if (control && control.classList) {
    control.classList.toggle('is-invalid', Boolean(message));
  }
}

function clearFieldError(name) {
  setError(name, '');
  if (LINKED_FIELDS[name]) {
    setError(LINKED_FIELDS[name], '');
  }
}

function clearErrors() {
  orderForm.querySelectorAll('[data-error-for]').forEach((holder) => setError(holder.dataset.errorFor, ''));
  orderFormError.classList.add('d-none');
}

function showErrors(errors) {
  const names = Object.keys(errors);
  names.forEach((name) => setError(name, errors[name]));
  const first = orderForm.elements[names[0]];
  if (first) {
    (first.focus ? first : first[0]).focus();
  }
}

function toCents(text) {
  if (!MONEY_PATTERN.test(text)) {
    return null;
  }
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function readOrderForm() {
  const f = orderForm.elements;
  const service = f.service_type.value === 'Others' ? f.service_other.value.trim() : f.service_type.value;
  return {
    customer_name: f.customer_name.value.trim(),
    customer_phone: f.customer_phone.value.trim(),
    customer_email: f.customer_email.value.trim(),
    order_channel: f.order_channel.value,
    service_type: service,
    quantity: f.quantity.value.trim(),
    unit_price: f.unit_price.value.trim(),
    due_date: f.due_date.value,
    fulfillment_method: f.fulfillment_method.value,
    delivery_address: f.delivery_address.value.trim(),
    discount_amount: f.apply_discount.checked ? f.discount_amount.value.trim() : '',
    description: f.description.value.trim()
  };
}

function validateOrder(values) {
  const errors = {};
  const f = orderForm.elements;

  if (!values.customer_name) {
    errors.customer_name = 'Enter the customer name.';
  } else if (values.customer_name.length > 120) {
    errors.customer_name = 'The name must be 120 characters or fewer.';
  }

  if (!values.customer_phone && !values.customer_email) {
    errors.customer_phone = 'Enter a phone number or an email address.';
  }

  if (values.customer_phone && (!PHONE_PATTERN.test(values.customer_phone) || values.customer_phone.replace(/\D/g, '').length < 7)) {
    errors.customer_phone = 'Enter a valid phone number.';
  }

  if (values.customer_email && (values.customer_email.length > 150 || !EMAIL_PATTERN.test(values.customer_email))) {
    errors.customer_email = 'Enter a valid email address.';
  }

  if (!values.order_channel) {
    errors.order_channel = 'Choose an order source.';
  }

  if (!f.service_type.value) {
    errors.service_type = 'Choose a printing service.';
  } else if (f.service_type.value === 'Others') {
    if (!values.service_type) {
      errors.service_other = 'Please specify the service.';
    } else if (values.service_type.length > 80) {
      errors.service_other = 'Keep it to 80 characters or fewer.';
    }
  }

  if (!/^\d+$/.test(values.quantity) || Number(values.quantity) < 1 || Number(values.quantity) > 100000) {
    errors.quantity = 'Enter a whole number from 1 to 100,000.';
  }

  if (!MONEY_PATTERN.test(values.unit_price) || Number(values.unit_price) <= 0) {
    errors.unit_price = 'Enter a price above 0 with up to 2 decimals.';
  }

  if (!values.due_date) {
    errors.due_date = 'Choose a due date.';
  }

  if (values.fulfillment_method === 'delivery') {
    if (!values.delivery_address) {
      errors.delivery_address = 'Enter the delivery address.';
    } else if (values.delivery_address.length > 2000) {
      errors.delivery_address = 'The address is too long.';
    }
  }

  if (f.apply_discount.checked) {
    if (!MONEY_PATTERN.test(values.discount_amount)) {
      errors.discount_amount = 'Enter a discount with up to 2 decimals.';
    } else if (!errors.quantity && !errors.unit_price) {
      const subtotal = Number(values.quantity) * toCents(values.unit_price);
      if (toCents(values.discount_amount) > subtotal) {
        errors.discount_amount = 'The discount cannot be more than the subtotal.';
      }
    }
  }

  if (values.description.length > 2000) {
    errors.description = 'The description must be 2000 characters or fewer.';
  }

  return errors;
}

function buildPayload(values) {
  return {
    customer_name: values.customer_name,
    customer_phone: values.customer_phone,
    customer_email: values.customer_email,
    order_channel: values.order_channel,
    service_type: values.service_type,
    description: values.description,
    quantity: Number(values.quantity),
    unit_price: values.unit_price,
    discount_amount: values.discount_amount || '0',
    due_date: values.due_date,
    fulfillment_method: values.fulfillment_method,
    delivery_address: values.fulfillment_method === 'delivery' ? values.delivery_address : ''
  };
}

function updateTotalPreview() {
  const f = orderForm.elements;
  const quantityText = f.quantity.value.trim();
  const quantity = /^\d+$/.test(quantityText) ? Number(quantityText) : 0;
  const price = toCents(f.unit_price.value.trim()) || 0;
  const discount = f.apply_discount.checked ? (toCents(f.discount_amount.value.trim()) || 0) : 0;
  const total = Math.max(quantity * price - discount, 0);
  totalPreview.textContent = formatPeso(total / 100);
}

function syncFormVisibility() {
  serviceOtherBox.classList.toggle('d-none', serviceSelect.value !== 'Others');
  addressBox.classList.toggle('d-none', orderForm.elements.fulfillment_method.value !== 'delivery');
  discountBox.classList.toggle('d-none', !orderForm.elements.apply_discount.checked);
  updateTotalPreview();
}

function showBackendError(error) {
  if (error.status === 401) {
    window.location.replace('login.html');
    return;
  }

  const hint = BACKEND_FIELD_HINTS.find(([pattern]) => pattern.test(error.message));

  if (hint) {
    const target = hint[1] === 'service_type' && serviceSelect.value === 'Others' ? 'service_other' : hint[1];
    setError(target, error.message);
    return;
  }

  orderFormError.textContent = error.message;
  orderFormError.classList.remove('d-none');
}

function openOrderForm() {
  orderForm.reset();
  clearErrors();
  syncFormVisibility();
  orderDrawer.show();
}

orderForm.addEventListener('input', (event) => {
  if (event.target.name) {
    clearFieldError(event.target.name);
  }
  updateTotalPreview();
});

orderForm.addEventListener('change', (event) => {
  if (event.target.name) {
    clearFieldError(event.target.name);
  }
  syncFormVisibility();
});

orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const values = readOrderForm();
  const errors = validateOrder(values);

  if (Object.keys(errors).length > 0) {
    showErrors(errors);
    return;
  }

  setButtonLoading(orderSaveBtn, true, 'Saving...');

  try {
    const data = await api.post('/orders/create.php', buildPayload(values));
    orderDrawer.hide();
    showToast('Order #ORD-' + data.order.id + ' saved. Total: ' + formatPeso(data.order.total_amount) + '.');
    document.dispatchEvent(new CustomEvent('orders:changed'));
  } catch (error) {
    showBackendError(error);
  } finally {
    setButtonLoading(orderSaveBtn, false);
  }
});

orderDrawerEl.addEventListener('shown.bs.offcanvas', () => {
  orderForm.elements.customer_name.focus();
});

document.getElementById('newOrderBtn').addEventListener('click', openOrderForm);

renderOptions();
syncFormVisibility();