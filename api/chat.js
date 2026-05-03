{% assign variantcount = product.variants | size %}
{% assign on_var = false %}
{% if variantcount > 1 %}
{% assign on_var = true %}
{% endif %}
{%assign contacts = false%}
{%if product.price == 0 %}
{%assign contacts = true%}
{%endif%}

{% include 'breadcrumb' %}
<section class="product" itemscope itemtype="http://schema.org/product">	
	<meta itemprop="url" content="{{ store.url }}{{ product.url }}">
	<meta itemprop="image" content="{{ product.featured_image.src | img_url: 'grande' }}">
	<meta itemprop="description" content="{{ product.summary_or_content | strip_html | truncate: 300 }}">
	<meta itemprop="name" content="{{ product.name }}">
	<meta itemprop="releaseDate" content="{{product.created_on | date: "%y-%m-%d"}}">

	<div class="container">
		<div class="row">
			<div class="col-lg-12 col-md-12 details-product">
				<div class="row product-bottom">
					<div class="clearfix padding-bottom-10">
						<div class="col-xs-12 col-sm-6 {% if settings.product_policy %}col-lg-5 col-md-4{% else %}col-lg-5 col-md-6{% endif %}">
							<div class="relative product-image-block {% if product.images.size < 2  %}no-thum{%endif%}">
								<div class="large-image">
									<a {%if settings.product_lightbox_enable%}href="{{ product.featured_image.src | img_url:'1024x1024' }}" data-rel="prettyPhoto[product-gallery]"{%endif %} class="large_image_url">
										<img id="zoom_01" src="{{ product.featured_image.src }}" alt="{{ product.name }}" class="img-responsive center-block">
									</a>							
								</div>	
								{%if product.images.size > 1%}
								<div id="gallery_01" class="owl-carousel owl-theme thumbnail-product margin-top-15" data-lg-items="5" data-md-items="5" data-sm-items="4" data-xs-items="4" data-margin="10" data-nav="true">
									{% for image in product.images %}
									<div class="item">
										<a class="thumb-link" href="javascript:void(0);" data-image="{{ image.src }}" data-zoom-image="{{ image.src | img_url:'1024x1024' }}">
											<img src="{{ image.src | img_url:'small' }}" alt="{{ product.name }}">
										</a>
									</div>
									{% endfor %}
								</div>
								{%endif%}
							</div>
						</div>

						<div class="col-xs-12 col-sm-6 {% if settings.product_policy %}col-lg-4 col-md-5{% else %}col-lg-7 col-md-6{% endif %} details-pro">
							<div class="product-top clearfix">
								<h1 class="title-head">{{ product.name }}</h1>
								
								<div class="price-box clearfix">
									{% if contacts %}
										<div class="special-price"><span class="price product-price">Liên hệ</span></div>
									{% else %}
										<span class="special-price">
											<span class="price product-price">{{ product.variants[0].price | money }}</span>
										</span>
										{% if product.variants[0].compare_at_price > product.variants[0].price %}
											<span class="old-price">
												<del class="price product-price-old">{{ product.variants[0].compare_at_price | money }}</del>
											</span>
										{% endif %}
										{% if variantcount > 1 %}
											<div style="color: #8b0000; font-weight: bold; font-size: 13px; margin-top:5px;">
												Khoảng giá: {{ product.price_min | money }} - {{ product.price_max | money }}
											</div>
										{% endif %}
									{% endif %}
								</div>
							</div>

							<div class="inve_brand margin-top-10">
								<strong>Thương hiệu:</strong> {{ product.vendor | default: 'Đang cập nhật' }}<br>
								<strong>Tình trạng:</strong> {% if product.available %}Còn hàng{% else %}Hết hàng{% endif %}
							</div>

							<div class="form-product margin-top-15">
								<form enctype="multipart/form-data" id="add-to-cart-form" action="/cart/add" method="post" class="form-inline">
									{% if variantcount > 1 %}
										<select id="product-selectors" name="variantid" style="display:none">
											{% for variant in product.variants %}
											<option value="{{ variant.id }}">{{ variant.title }}</option>
											{% endfor %}
										</select>
									{% else %}
										<input type="hidden" name="variantid" value="{{ product.variants[0].id }}" />
									{% endif %}

									<div class="form-group {%if contacts%}hidden{%endif%}">
										<button type="submit" class="btn btn-lg btn-gray btn_buy">Mua ngay</button>
									</div>
									<button class="btn-callmeback" type="button" data-toggle="modal" data-target="#mymodalcall">
										<i class="ion ion-ios-alarm"></i> Báo giá
									</button>
									<button class="btn-callmeback" type="button" onclick="window.location.href='tel:{{ store.phone_number | remove: ' '}}'">
										<i class="ion ion-ios-call"></i> {{ store.phone_number }}
									</button>
								</form>
							</div>
						</div>
						
						{% if settings.product_policy %}
						<div class="col-xs-12 col-sm-12 col-lg-3 col-md-3 hidden-sm hidden-xs">
							{% include 'product-sidebar' %}
						</div>
						{% endif %}
					</div>
				</div>
				
				<div class="row margin-top-10">
					<div class="col-md-9">
						<div class="product-tab e-tabs padding-bottom-10">		
							<div class="border-ghghg margin-bottom-20">
								<ul class="tabs tabs-title clearfix">	
									<li class="tab-link current" data-tab="tab-1"><h3><span>Mô tả</span></h3></li>																	
								</ul>																									
							</div>
							<div id="tab-1" class="tab-content current">
								<div class="rte">
									{% if product.content != "" %}
										{{ product.content }}
									{% else %}
										Nội dung đang được cập nhật...
									{% endif %}
								</div>
							</div>	
						</div>				
					</div>
					<div class="col-md-3">
						<div class="right_module">
							{% include 'sticky-product' %}
							{% include 'similar-product' %}
						</div>
					</div>
				</div>

				{% if settings.product_recent_enable %}
				{% assign check11 = product.url %}
				{% assign productrelate = product.collections.last.alias %}
				<div class="row margin-top-20 margin-bottom-10">
					<div class="col-lg-12">
						<div class="related-product">
							<div class="home-title">
								<h2><a href="/{{ productrelate }}">{{ settings.product_recent_title | default: 'Sản phẩm cùng loại' }}</a></h2>
							</div>
							<div class="section-tour-owl owl-carousel not-dqowl products-view-grid margin-top-10" data-md-items="5" data-sm-items="4" data-xs-items="2" data-margin="10">
								{% for product in collections[productrelate].products limit: 10 %}
									{% unless check11 == product.url %}
									<div class="item">
										{% include 'product-grid-item' %}
									</div>
									{% endunless %}
								{% endfor %}
							</div>
						</div>
					</div>
				</div>					
				{% endif %}
			</div>
		</div>
	</div>
</section>

<script>
	$(document).ready(function() {
		// Xử lý click ảnh thumbnail
		$(document).on('click', '.thumb-link', function(e) {
			e.preventDefault();
			var newImg = $(this).attr('data-image');
			var zoomImg = $(this).attr('data-zoom-image');
			$('#zoom_01').attr('src', newImg);
			$('.large_image_url').attr('href', zoomImg);
		});

		// Khởi tạo các thanh trượt (Owl Carousel)
		$(".owl-carousel").each(function(){
			$(this).owlCarousel({
				loop: false,
				margin: $(this).data('margin') || 10,
				nav: true,
				dots: false,
				responsive: {
					0: { items: $(this).data('xs-items') || 2 },
					768: { items: $(this).data('sm-items') || 4 },
					1024: { items: $(this).data('md-items') || 5 }
				}
			});
		});
	});

	var selectCallback = function(variant, selector) {
		if (variant) {
			var productPrice = $('.details-pro .product-price');
			var comparePrice = $('.details-pro .product-price-old');

			if(variant.price > 0) {
				productPrice.html(Bizweb.formatMoney(variant.price, "{{ store.money_format }}"));
				if(variant.compare_at_price > variant.price) {
					comparePrice.html(Bizweb.formatMoney(variant.compare_at_price, "{{ store.money_format }}")).show();
				} else {
					comparePrice.hide();
				}
			} else {
				productPrice.html('Liên hệ');
				comparePrice.hide();
			}

			// Đổi ảnh khi chọn biến thể
			if (variant.featured_image) {
				$('#zoom_01').attr('src', variant.featured_image.src);
			}
		}
	};

	{% if product.variants.size > 1 %}
	new Bizweb.OptionSelectors('product-selectors', {
		product: {{ product | json }},
		onVariantSelected: selectCallback,
		enableHistoryState: true
	});
	{% endif %}
</script>
